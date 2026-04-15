import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

settings = get_settings()


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Gmail SMTP. Returns True on success."""
    if not settings.smtp_email or not settings.smtp_password:
        print(f"[Email] SMTP not configured, skipping email to {to_email}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_email, settings.smtp_password)
            server.sendmail(settings.smtp_email, to_email, msg.as_string())

        print(f"[Email] Sent to {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"[Email] Failed to send to {to_email}: {e}")
        return False


def send_shortlist_email(
    to_email: str,
    candidate_name: str,
    pipeline_title: str,
    round_completed: int,
    next_round: int,
    score: int,
    login_url: str = "http://localhost:3001/login",
):
    round_labels = {1: "Screening", 2: "Technical", 3: "HR & Cultural"}
    subject = f"Congratulations! You've been shortlisted for Round {next_round} - {pipeline_title}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AI Interview Platform</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Congratulations, {candidate_name}! 🎉</h2>
            <p style="color: #555; line-height: 1.6;">
                You've successfully completed <strong>Round {round_completed} ({round_labels.get(round_completed, '')})</strong>
                for the position: <strong>{pipeline_title}</strong>.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 14px;">Your Score</p>
                <p style="margin: 5px 0 0; color: #15803d; font-size: 36px; font-weight: bold;">{score}/100</p>
            </div>
            <p style="color: #555; line-height: 1.6;">
                You've been <strong>shortlisted for Round {next_round} ({round_labels.get(next_round, '')})</strong>.
                Please log in to your account to begin the next round.
            </p>
            <div style="text-align: center; margin: 25px 0;">
                <a href="{login_url}" style="background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Start Round {next_round}
                </a>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                If you have any questions, please contact the HR team.
            </p>
        </div>
        <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 15px;">
            This is an automated email from AI Interview Platform. Do not reply.
        </p>
    </div>
    """
    return send_email(to_email, subject, html)


def send_rejection_email(
    to_email: str,
    candidate_name: str,
    pipeline_title: str,
    round_number: int,
    score: int,
):
    round_labels = {1: "Screening", 2: "Technical", 3: "HR & Cultural"}
    subject = f"Application Update - {pipeline_title}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a1a2e; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AI Interview Platform</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Thank you, {candidate_name}</h2>
            <p style="color: #555; line-height: 1.6;">
                Thank you for completing <strong>Round {round_number} ({round_labels.get(round_number, '')})</strong>
                for the position: <strong>{pipeline_title}</strong>.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">Your Score</p>
                <p style="margin: 5px 0 0; color: #dc2626; font-size: 36px; font-weight: bold;">{score}/100</p>
            </div>
            <p style="color: #555; line-height: 1.6;">
                Unfortunately, your score did not meet the minimum threshold of 60% required to advance to the next round.
                We appreciate your time and effort, and encourage you to apply for future opportunities.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                We wish you the best in your career journey.
            </p>
        </div>
    </div>
    """
    return send_email(to_email, subject, html)


def send_hired_email(
    to_email: str,
    candidate_name: str,
    pipeline_title: str,
    score: int,
):
    subject = f"Welcome aboard! You've been selected - {pipeline_title}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome Aboard!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Congratulations, {candidate_name}! 🎊</h2>
            <p style="color: #555; line-height: 1.6;">
                We're thrilled to inform you that you've successfully completed all interview rounds
                for <strong>{pipeline_title}</strong> and have been <strong>recommended for hiring</strong>!
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 14px;">Final Score</p>
                <p style="margin: 5px 0 0; color: #15803d; font-size: 36px; font-weight: bold;">{score}/100</p>
            </div>
            <p style="color: #555; line-height: 1.6;">
                Our HR team will reach out to you shortly with the next steps regarding onboarding.
            </p>
        </div>
    </div>
    """
    return send_email(to_email, subject, html)
