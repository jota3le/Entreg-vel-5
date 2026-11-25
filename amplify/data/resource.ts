import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Venda: a
    .model({
      cliente: a.string().required(),
      produto: a.string().required(),
      valor: a.float().required(),
      status: a.string().required(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
