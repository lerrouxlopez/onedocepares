use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Config(String),
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
    fields: serde_json::Value,
    request_id: String,
}

impl AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) | Self::Config(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Sqlx(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) | Self::Config(_) => "BAD_REQUEST",
            Self::Unauthorized(_) => "UNAUTHORIZED",
            Self::Forbidden(_) => "FORBIDDEN",
            Self::NotFound(_) => "NOT_FOUND",
            Self::Sqlx(_) => "INTERNAL_ERROR",
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ErrorEnvelope {
            error: ErrorBody {
                code: self.code(),
                message: self.to_string(),
                fields: serde_json::json!({}),
                request_id: Uuid::new_v4().to_string(),
            },
        };

        (status, Json(body)).into_response()
    }
}
