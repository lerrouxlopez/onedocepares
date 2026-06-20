use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::header::ContentType,
    transport::smtp::authentication::Credentials,
};
use tracing::{info, warn};

use crate::config::Config;

async fn send(config: &Config, to: &str, subject: &str, body: &str) {
    let host = match &config.smtp_host {
        Some(h) => h.clone(),
        None => {
            info!(to, subject, "SMTP not configured, skipping email");
            return;
        }
    };

    let email = match Message::builder()
        .from(
            config
                .smtp_from
                .parse()
                .unwrap_or_else(|_| "no-reply@onedocepares.com".parse().expect("valid fallback")),
        )
        .to(match to.parse() {
            Ok(addr) => addr,
            Err(e) => {
                warn!(to, error = %e, "Invalid recipient address, skipping email");
                return;
            }
        })
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body.to_string())
    {
        Ok(m) => m,
        Err(e) => {
            warn!(error = %e, "Failed to build email message");
            return;
        }
    };

    let builder = match AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host) {
        Ok(b) => b,
        Err(e) => {
            warn!(host, error = %e, "Failed to create SMTP transport");
            return;
        }
    };

    let builder = builder.port(config.smtp_port);

    let transport = if let (Some(user), Some(pass)) = (&config.smtp_username, &config.smtp_password)
    {
        builder
            .credentials(Credentials::new(user.clone(), pass.clone()))
            .build()
    } else {
        builder.build()
    };

    match transport.send(email).await {
        Ok(_) => info!(to, subject, "Email sent"),
        Err(e) => warn!(to, subject, error = %e, "Failed to send email"),
    }
}

pub async fn notify_registration_approved(
    config: &Config,
    user_email: &str,
    tournament_name: &str,
    team_name: &str,
) {
    let subject = format!("Registration approved: {team_name} for {tournament_name}");
    let body = format!(
        "Your team \"{team_name}\" has been approved for \"{tournament_name}\".\n\nSee you there!"
    );
    send(config, user_email, &subject, &body).await;
}

pub async fn notify_comment_approved(config: &Config, user_email: &str, feed_title: &str) {
    let subject = "Your comment was approved".to_string();
    let body = format!("Your comment on \"{feed_title}\" has been approved and is now visible.");
    send(config, user_email, &subject, &body).await;
}

pub async fn notify_badge_awarded(
    config: &Config,
    user_email: &str,
    badge_name: &str,
    entity_name: &str,
) {
    let subject = format!("Badge awarded: {badge_name}");
    let body =
        format!("Congratulations! \"{entity_name}\" has been awarded the \"{badge_name}\" badge.");
    send(config, user_email, &subject, &body).await;
}
