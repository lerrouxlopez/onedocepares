mod app;
mod routes;

use std::{env, net::SocketAddr};

use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = app::build_router().layer(TraceLayer::new_for_http());
    let port = env::var("API_PORT").unwrap_or_else(|_| "8000".to_string());
    let address: SocketAddr = format!("0.0.0.0:{port}").parse()?;
    let listener = TcpListener::bind(address).await?;

    info!("listening on {}", listener.local_addr()?);

    axum::serve(listener, app).await?;

    Ok(())
}
