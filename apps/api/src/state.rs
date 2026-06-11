use sqlx::PgPool;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub service_name: &'static str,
    pub service_version: &'static str,
    pub config: Config,
    pub db: PgPool,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        Self {
            service_name: "onedocepares-api",
            service_version: env!("CARGO_PKG_VERSION"),
            config,
            db,
        }
    }
}
