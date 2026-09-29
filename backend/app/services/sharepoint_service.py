"""Find invoice PDFs in SharePoint via Microsoft Graph (app-only auth).

Sales invoices live in the Shared Services site, one folder per year of the
invoice's document date, named "{ref_no1}_<anything>.pdf". Given a Ref. 1
and its doc date we list that year's folder and return the matching file's
SharePoint webUrl. Opening that URL still goes through the *user's own*
SharePoint sign-in, so their normal SharePoint permissions apply — this
service only locates the file.
"""
import time
from datetime import date
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.config import settings

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "quandatics.sharepoint.com:/sites/Quandatics_Shared_Services"

FINANCE_ROOT = "Group_Finance"

# App entity -> (company folder under Group_Finance, code used in its
# sub-folder names). Sales invoices for a doc-date year live in
#   Group_Finance/<company folder>/<code> Admin Account/<code> Debtor Invoice/<code> Invoice <year>
COMPANIES = {
    "QM":        ("01. Quandatics M Sdn Bhd",        "QM"),
    "QA":        ("02. Quandatics Academy Sdn Bhd",  "QA"),
    "QAW":       ("04. Q At Work Sdn Bhd",           "QAW"),
    "Daltos":    ("05. Daltos Sdn Bhd",              "DT"),
    "QSG":       ("09. Quandatics Pte Ltd (SG)",     "QSG"),
    "CC":        ("12. Citrus Cloud Sdn Bhd",        "CC"),
    "QArmour":   ("13. Q Armour Sdn Bhd",            "QAR"),
    "QOmnitech": ("14. Quandatics Omnitech Sdn Bhd", "OMT"),
}
# Case-insensitive entity lookup (the app sends e.g. "QArmour").
_COMPANY_BY_KEY = {k.lower(): v for k, v in COMPANIES.items()}
# ...and by the short folder code too (e.g. "QAR", "DT", "OMT"), in case the
# app stores that form as the entity code.
_COMPANY_BY_KEY.update({code.lower(): (folder, code) for folder, code in COMPANIES.values()})


def sales_invoice_folder(entity: str, year: int):
    """Expected folder path for an entity's sales invoices of a given year,
    or None if the entity has no SharePoint folder configured."""
    c = _COMPANY_BY_KEY.get((entity or "").lower())
    if not c:
        return None
    company, code = c
    return f"{FINANCE_ROOT}/{company}/{code} Admin Account/{code} Debtor Invoice/{code} Invoice {year}"

# Purchase invoices, per entity; {year} = year of the invoice's doc date.
# Files are named  <PV no.>--<Supplier name>_<Purchase inv no.>_<description>
# (e.g. "A0123--ABC Supplies Sdn Bhd_INV-7788_Laptop repair.pdf") and are
# matched on the purchase invoice no. = the line's Ref. 2.
PURCHASE_INVOICE_FOLDERS = {
    "qm": FINANCE_ROOT + "/01. Quandatics M Sdn Bhd/QM Account/QM_Payable & Creditor/QM_Payable & Creditor Invoice/QM_Pymt List & Inv_{year}",
}

FOLDER_CACHE_SECONDS = 300   # new PDFs show up within 5 min (a miss refreshes at once)


def _norm(s: str) -> str:
    """Compare invoice numbers ignoring case, spaces and punctuation — file
    names can't contain '/', so 'INV/7788' is saved as e.g. 'INV-7788'."""
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def purchase_name_matches(filename: str, ref_no2: str) -> bool:
    """True if the purchase inv no. segment of '<PV>--<Supplier>_<Inv>_<desc>.ext'
    equals ref_no2. Any '_'-separated piece after '--' counts, so supplier
    names containing '_' don't shift the match."""
    key = _norm(ref_no2)
    if not key:
        return False
    stem = filename.rsplit(".", 1)[0]
    after = stem.split("--", 1)[1] if "--" in stem else stem
    return any(_norm(part) == key for part in after.split("_"))


class SharePointService:
    _token = None          # (access_token, expires_at)
    _drive_id = None
    _folders = {}          # folder path -> (fetched_at, [{"name","webUrl","isFolder"}])
    _resolved = {}         # (entity, year) -> resolved year-folder path

    # ── auth ────────────────────────────────────────────────────────────
    def _get_token(self) -> str:
        if not (settings.graph_tenant_id and settings.graph_client_id and settings.graph_client_secret):
            raise HTTPException(503, "Invoice links are not configured on the server (GRAPH_* settings missing).")
        tok = SharePointService._token
        if tok and tok[1] - 60 > time.time():
            return tok[0]
        r = httpx.post(
            f"https://login.microsoftonline.com/{settings.graph_tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": settings.graph_client_id,
                "client_secret": settings.graph_client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
            timeout=15,
        )
        if r.status_code != 200:
            raise HTTPException(502, f"Could not sign in to Microsoft Graph: {r.text[:300]}")
        body = r.json()
        SharePointService._token = (body["access_token"], time.time() + int(body.get("expires_in", 3600)))
        return body["access_token"]

    def _get(self, url: str) -> dict:
        r = httpx.get(url, headers={"Authorization": f"Bearer {self._get_token()}"}, timeout=20)
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise HTTPException(502, f"Microsoft Graph error {r.status_code}: {r.text[:300]}")
        return r.json()

    def _get_drive_id(self) -> str:
        """ID of the site's "Shared Documents" library.

        Path-addressed sites need a closing ':' before any sub-resource
        (/sites/{host}:/sites/{name}:/drives) — without it Graph treats the
        rest as part of the site path and returns 404. So: resolve the site,
        then pick the library whose URL ends in /Shared Documents (falling
        back to the site's default library)."""
        if not SharePointService._drive_id:
            site = self._get(f"{GRAPH}/sites/{SITE}?$select=id,webUrl")
            if not site:
                raise HTTPException(502, f"SharePoint site not found: https://{SITE.replace(':', '')}")
            drives = self._get(f"{GRAPH}/sites/{site['id']}/drives?$select=id,name,webUrl") or {}
            chosen = None
            for d in drives.get("value", []):
                url = (d.get("webUrl") or "").rstrip("/").lower()
                if url.endswith("/shared%20documents") or url.endswith("/shared documents") \
                        or d.get("name") in ("Documents", "Shared Documents"):
                    chosen = d
                    break
            if not chosen:
                chosen = self._get(f"{GRAPH}/sites/{site['id']}/drive?$select=id")
            if not chosen:
                names = ", ".join(d.get("name", "?") for d in drives.get("value", [])) or "none"
                raise HTTPException(502, f"'Shared Documents' library not found on the site (libraries: {names}).")
            SharePointService._drive_id = chosen["id"]
        return SharePointService._drive_id

    # ── folder listing (cached) ─────────────────────────────────────────
    def _list_folder(self, path: str, force: bool = False) -> list:
        """Children of a folder: [{"name","webUrl","isFolder"}]. None if the folder doesn't exist."""
        cached = SharePointService._folders.get(path)
        if cached and not force and time.time() - cached[0] < FOLDER_CACHE_SECONDS:
            return cached[1]
        url = f"{GRAPH}/drives/{self._get_drive_id()}/root:/{quote(path)}:/children?$select=name,webUrl,file,folder&$top=999"
        items = []
        while url:
            page = self._get(url)
            if page is None:
                return None
            items += [{"name": i["name"], "webUrl": i["webUrl"], "isFolder": "folder" in i}
                      for i in page.get("value", [])]
            url = page.get("@odata.nextLink")
        SharePointService._folders[path] = (time.time(), items)
        return items

    def _resolve_year_folder(self, entity: str, year: int) -> str:
        """Path of the entity's '<code> Invoice <year>' folder.

        Tries the expected path first; if a sub-folder is named slightly
        differently, walks down by pattern instead: the folder ending in
        'Admin Account' -> 'Debtor Invoice' -> 'Invoice <year>'."""
        key = (entity.lower(), year)
        if key in SharePointService._resolved:
            return SharePointService._resolved[key]
        expected = sales_invoice_folder(entity, year)
        if expected is None:
            raise HTTPException(404, f"No SharePoint invoice folder is set up for entity {entity}.")
        if self._list_folder(expected) is not None:
            SharePointService._resolved[key] = expected
            return expected

        company = _COMPANY_BY_KEY[entity.lower()][0]
        path = f"{FINANCE_ROOT}/{company}"
        for suffix in ("admin account", "debtor invoice", f"invoice {year}"):
            children = self._list_folder(path)
            if children is None:
                raise HTTPException(404, f"SharePoint folder not found: {path}")
            folders = sorted(c["name"] for c in children if c["isFolder"] and c["name"].lower().strip().endswith(suffix))
            if not folders:
                raise HTTPException(404, f"No folder ending in '{suffix.title()}' inside '{path}'.")
            path = f"{path}/{folders[0]}"
        SharePointService._resolved[key] = path
        return path

    # ── public ──────────────────────────────────────────────────────────
    def find_sales_invoice(self, entity: str, ref_no1: str, doc_date: date) -> dict:
        ref = (ref_no1 or "").strip()
        if not ref:
            raise HTTPException(400, "Missing invoice number (Ref. 1).")
        path = self._resolve_year_folder(entity, doc_date.year)

        def match(items):
            key = ref.lower()
            hits = [i for i in (items or [])
                    if not i["isFolder"] and i["name"].lower().endswith(".pdf")
                    and (i["name"].lower().startswith(key + "_") or i["name"].lower() == key + ".pdf")]
            return sorted(hits, key=lambda i: i["name"])

        hits = match(self._list_folder(path))
        if not hits:                                   # maybe uploaded since the cache was filled
            hits = match(self._list_folder(path, force=True))
        if not hits:
            raise HTTPException(404, f"No PDF named '{ref}_...' found in '{path.split('/')[-1]}'.")
        return {"url": hits[0]["webUrl"], "name": hits[0]["name"], "matches": len(hits)}

    def find_purchase_invoice(self, entity: str, ref_no2: str, doc_date: date) -> dict:
        """Purchase invoice file whose name carries Ref. 2 as the purchase
        inv no. Looks in the doc-date year's folder first, then the next
        year's (an invoice dated late in the year may be filed with the
        following year's payment list)."""
        template = PURCHASE_INVOICE_FOLDERS.get((entity or "").lower())
        if not template:
            raise HTTPException(404, f"No SharePoint purchase invoice folder is set up for entity {entity}.")
        ref = (ref_no2 or "").strip()
        if not ref:
            raise HTTPException(400, "This purchase line has no Ref. 2 (supplier invoice no.) to look up.")

        def match(items):
            hits = [i for i in (items or []) if not i["isFolder"] and purchase_name_matches(i["name"], ref)]
            # PDFs first, then by name
            return sorted(hits, key=lambda i: (not i["name"].lower().endswith(".pdf"), i["name"]))

        tried = []
        for year in (doc_date.year, doc_date.year + 1):
            path = template.format(year=year)
            items = self._list_folder(path)
            if items is None:
                continue
            tried.append(path.split("/")[-1])
            hits = match(items) or match(self._list_folder(path, force=True))
            if hits:
                return {"url": hits[0]["webUrl"], "name": hits[0]["name"], "matches": len(hits)}
        if not tried:
            raise HTTPException(404, f"Purchase invoice folder not found: {template.format(year=doc_date.year)}")
        raise HTTPException(404, f"No file with purchase inv no. '{ref}' found in {' / '.join(tried)}.")
