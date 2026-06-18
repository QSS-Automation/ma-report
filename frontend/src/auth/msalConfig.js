export const msalConfig = {
  auth: {
    clientId:    process.env.REACT_APP_MS_CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${process.env.REACT_APP_MS_TENANT_ID}`,
    redirectUri: process.env.REACT_APP_REDIRECT_URI || "http://localhost:3000",
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation:          "sessionStorage",  // don't use localStorage
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};

// ← Add this — Teams SSO scope
export const teamsLoginRequest = {
  scopes: [`api://delightful-bay-0d1d05610.7.azurestaticapps.net/${process.env.REACT_APP_MS_CLIENT_ID}/access_as_user`],
};
