use sqlx::{PgPool, postgres::PgPoolOptions};

use crate::config::Config;

pub fn create_pool(config: &Config) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect_lazy(&config.database_url)
}
