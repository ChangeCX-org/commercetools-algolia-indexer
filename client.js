import fetch from "node-fetch";
import { ClientBuilder } from "@commercetools/sdk-client-v2";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";

export const projectKey = "hermanmiller_dev_demo";
const authMiddlewareOptions = {
  host: "https://auth.us-central1.gcp.commercetools.com",
  projectKey,
  credentials: {
    clientId: "XjjA-HcYMNfDYeZSL98z7li-",
    clientSecret: "DkPCvCp0Rs5xvtcK-WOYFjxLwolXBhHz",
  },
  scopes: [
    "manage_orders:hermanmiller_dev_demo view_customers:hermanmiller_dev_demo view_published_products:hermanmiller_dev_demo create_anonymous_token:hermanmiller_dev_demo manage_my_orders:hermanmiller_dev_demo",
  ],
  fetch,
};

const httpMiddlewareOptions = {
  host: "https://api.us-central1.gcp.commercetools.com",
  fetch,
};

const client = new ClientBuilder()
  .withProjectKey(projectKey)
  .withClientCredentialsFlow(authMiddlewareOptions)
  .withHttpMiddleware(httpMiddlewareOptions)
  .withLoggerMiddleware()
  .build();

export const getApiRoot = () => {
  return createApiBuilderFromCtpClient(client);
};
