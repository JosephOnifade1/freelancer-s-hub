/** Shared Node-only pg options. Imported behind the application's server-only
 * boundary and by the explicit local verification CLI. Never log these options. */
export function poolOptions(settings, configuredMax) {
  const max = configuredMax === undefined ? 10 : Number(configuredMax);
  if (!Number.isSafeInteger(max) || max < 1) throw new Error("invalid_pool_max");
  return {
    connectionString: settings.connectionString,
    ssl: settings.ssl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "borynx-next",
  };
}
