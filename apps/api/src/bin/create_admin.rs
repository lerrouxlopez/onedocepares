/// Creates an admin user in the database.
/// Usage: cargo run --bin create_admin -- <email> <display_name> <password>
use api::services::auth::hash_password;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        eprintln!("Usage: create_admin <email> <display_name> <password>");
        std::process::exit(1);
    }

    let email = &args[1];
    let display_name = &args[2];
    let password = &args[3];

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/onedocepares".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;

    let password_hash =
        hash_password(password).map_err(|e| format!("failed to hash password: {e}"))?;

    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(user_id)
    .bind(email.as_str())
    .bind(display_name.as_str())
    .bind(&password_hash)
    .execute(&pool)
    .await?;

    sqlx::query(
        "INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'admin'",
    )
    .bind(user_id)
    .execute(&pool)
    .await?;

    println!("Admin user created: {email} (id: {user_id})");
    println!("Run migrations first if you haven't: sqlx migrate run");

    Ok(())
}
