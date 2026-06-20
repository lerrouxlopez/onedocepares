use std::{env, net::SocketAddr, str::FromStr};

use crate::error::AppError;

#[derive(Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub database_url: String,
    pub rust_log: String,
    pub session_cookie_name: String,
    pub secure_cookies: bool,
    pub session_ttl_hours: i64,
    pub uploads_dir: String,
    pub smtp_host: Option<String>,
    pub smtp_port: u16,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_from: String,
    pub superadmin_email: Option<String>,
    pub superadmin_password: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        let port = env::var("API_PORT").unwrap_or_else(|_| "8000".to_string());
        let bind_addr = SocketAddr::from_str(&format!("0.0.0.0:{port}"))
            .map_err(|error| AppError::Config(format!("invalid API_PORT: {error}")))?;

        Ok(Self {
            bind_addr,
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://postgres:postgres@localhost:5432/onedocepares".to_string()
            }),
            rust_log: env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=info".to_string()),
            session_cookie_name: env::var("SESSION_COOKIE_NAME")
                .unwrap_or_else(|_| "odp_session".to_string()),
            secure_cookies: env::var("SECURE_COOKIES")
                .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE"))
                .unwrap_or(false),
            session_ttl_hours: env::var("SESSION_TTL_HOURS")
                .ok()
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(24),
            uploads_dir: env::var("UPLOADS_DIR").unwrap_or_else(|_| "./uploads".to_string()),
            smtp_host: env::var("SMTP_HOST").ok(),
            smtp_port: env::var("SMTP_PORT")
                .ok()
                .and_then(|v| v.parse::<u16>().ok())
                .unwrap_or(587),
            smtp_username: env::var("SMTP_USERNAME").ok(),
            smtp_password: env::var("SMTP_PASSWORD").ok(),
            smtp_from: env::var("SMTP_FROM")
                .unwrap_or_else(|_| "no-reply@onedocepares.com".to_string()),
            superadmin_email: env::var("SUPERADMIN_USER").ok(),
            superadmin_password: env::var("SUPERADMIN_PASSWORD").ok(),
        })
    }
}
