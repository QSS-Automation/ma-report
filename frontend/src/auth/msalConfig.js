export const msalConfig = {
  auth: {
    clientId:    process.env.REACT_APP_MS_CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${process.env.REACT_APP_MS_TENANT_ID}`,
    redirectUri: process.env.REACT_APP_REDIRECT_URI || "http://localhost:3000",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation:          "sessionStorage",  // don't use localStorage
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};
