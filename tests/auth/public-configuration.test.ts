import {describe,it,expect} from "vitest";
import {localDevelopmentRequest,publicAuthConfiguration} from "../../src/server/auth/public-configuration";
describe("public email configuration (no secrets or live services)",()=>{
 const env={NODE_ENV:"development",BORYNX_ENVIRONMENT:"development",BETTER_AUTH_URL:"http://localhost:3000",EMAIL_DELIVERY_MODE:"file"} as NodeJS.ProcessEnv;
 it("file mode requires development and loopback",()=>{
  expect(publicAuthConfiguration(env).emailDelivery).toBe("file");
  for(const change of [{NODE_ENV:"production"},{BORYNX_ENVIRONMENT:"production"},{BETTER_AUTH_URL:"https://example.com"}])expect(publicAuthConfiguration({...env,...change} as NodeJS.ProcessEnv).emailDelivery).toBe("unavailable");
 });
 it("disabled or malformed gateway modes are unavailable",()=>{
  expect(publicAuthConfiguration({NODE_ENV:"production"}).emailDelivery).toBe("unavailable");
  expect(publicAuthConfiguration({NODE_ENV:"production",EMAIL_DELIVERY_MODE:"gateway",EMAIL_GATEWAY_URL:"http://example.com",EMAIL_API_KEY:"secret",EMAIL_FROM:"test"}).emailDelivery).toBe("unavailable");
 });
 it("valid gateway config returns no secrets or addresses",()=>{
  const config=publicAuthConfiguration({NODE_ENV:"production",EMAIL_DELIVERY_MODE:"gateway",EMAIL_GATEWAY_URL:"https://example.com/mail",EMAIL_API_KEY:"private-key",EMAIL_FROM:"private@example.com"});
  expect(config.emailDelivery).toBe("email");expect(JSON.stringify(config)).not.toContain("private");
 });
 it("developer diagnostics require a local development request",()=>{
  expect(localDevelopmentRequest(new Request("http://localhost:3000"),env)).toBe(true);
  expect(localDevelopmentRequest(new Request("https://example.com"),env)).toBe(false);
  expect(localDevelopmentRequest(new Request("http://localhost:3000"),{NODE_ENV:"production"})).toBe(false);
 });
});
