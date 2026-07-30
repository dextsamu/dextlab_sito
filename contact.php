<?php
/**
 * Dext Lab — contact form handler.
 * Valida, invia il lead a te + autoresponder al cliente.
 * Usa SMTP (PHPMailer) se configurato in config.php, altrimenti mail().
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/inc/db.php';
$cfg = dext_config();
// settings DB sovrascrivono config.php (admin panel)
foreach (settings_all() as $k => $v) {
    if (in_array($k, ['contact_email', 'smtp_enabled', 'smtp_host', 'smtp_user', 'smtp_pass', 'smtp_port', 'smtp_secure',
                      'tg_enabled', 'tg_token', 'tg_chat'], true)) {
        $cfg[$k] = $v;
    }
}
if (!empty($cfg['contact_email'])) { $cfg['mail_to'] = $cfg['contact_email']; }
$TO        = $cfg['mail_to']        ?? 'info@dextlab.it';
$FROM      = $cfg['mail_from']      ?? 'info@dextlab.it';
$FROM_NAME = $cfg['mail_from_name'] ?? 'Dext Lab';
$SITE      = 'Dext Lab';

function out($ok, $message, $code = 200) {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 'Metodo non consentito.', 405);

// honeypot
if (!empty($_POST['website'])) out(true, 'Messaggio inviato! Ti rispondo entro 24 ore.');

// anti-spam: max 5 invii / 15 min per IP
if (!rate_limit('contact', 5, 900)) {
    out(false, 'Hai inviato troppi messaggi. Riprova tra qualche minuto o scrivimi a info@dextlab.it.', 429);
}

$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$subject = trim($_POST['subject'] ?? '');
$message = trim($_POST['message'] ?? '');

$errors = [];
if ($name === '' || mb_strlen($name) > 120)        $errors[] = 'nome';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    $errors[] = 'email';
if ($message === '' || mb_strlen($message) > 5000) $errors[] = 'messaggio';
if ($errors) out(false, 'Controlla i campi: ' . implode(', ', $errors) . '.', 422);

$bad = ["\r", "\n", "%0a", "%0d"];
$cName    = str_ireplace($bad, '', $name);
$cEmail   = str_ireplace($bad, '', $email);
$subject  = $subject === '' ? 'Nuovo contatto dal sito' : $subject;
$cSubject = str_ireplace($bad, '', $subject);

// ---- salva lead in DB (non blocca l'invio email se fallisce) ----
$pdo = db();
if ($pdo) {
    try {
        $st = $pdo->prepare('INSERT INTO leads (name, email, subject, message, source, ip, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
        $st->execute([
            mb_substr($cName, 0, 120),
            mb_substr($cEmail, 0, 190),
            mb_substr($cSubject, 0, 190),
            $message,
            'form',
            $_SERVER['REMOTE_ADDR'] ?? null,
            'new',
        ]);
    } catch (Throwable $ex) { /* ignora: l'email resta il canale primario */ }
}

// ---- notifica Telegram istantanea (best-effort, non blocca) ----
if (!empty($cfg['tg_enabled']) && !empty($cfg['tg_token']) && !empty($cfg['tg_chat'])) {
    $tgText = "🔔 Nuovo lead — $SITE\n\n👤 $cName\n✉️ $cEmail\n📋 $cSubject\n\n" . mb_substr($message, 0, 600);
    $tgUrl = 'https://api.telegram.org/bot' . $cfg['tg_token'] . '/sendMessage';
    $tch = curl_init($tgUrl);
    curl_setopt_array($tch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_POSTFIELDS     => http_build_query(['chat_id' => $cfg['tg_chat'], 'text' => $tgText, 'disable_web_page_preview' => 'true']),
    ]);
    @curl_exec($tch);
    @curl_close($tch);
}

// ---- corpo email lead (per te) ----
$leadSubject = "[$SITE] $cSubject";
$leadBody  = "Nuovo messaggio dal sito $SITE\n-----------------------------------\n";
$leadBody .= "Nome:    $cName\nEmail:   $cEmail\nOggetto: $cSubject\n";
$leadBody .= "-----------------------------------\n\n$message\n\n";
$leadBody .= "-----------------------------------\nIP: " . ($_SERVER['REMOTE_ADDR'] ?? 'n/d') . " — " . date('d/m/Y H:i') . "\n";

// ---- autoresponder (per il cliente) ----
$autoSubject = "Abbiamo ricevuto il tuo messaggio — $SITE";
$autoBody  = "Ciao $cName,\n\ngrazie per averci scritto! Ho ricevuto la tua richiesta e ti risponderò entro 24 ore.\n\n";
$autoBody .= "Riepilogo del tuo messaggio:\n\"$message\"\n\n";
$autoBody .= "A presto,\nil team di $SITE\ninfo@dextlab.it";

// ---- tenta SMTP via PHPMailer ----
$sentLead = false;
$usedSmtp = false;

if (!empty($cfg['smtp_enabled'])) {
    // autoload PHPMailer (composer o cartella PHPMailer/src)
    if (!class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        if (is_file(__DIR__ . '/vendor/autoload.php')) require_once __DIR__ . '/vendor/autoload.php';
        elseif (is_file(__DIR__ . '/PHPMailer/src/PHPMailer.php')) {
            require_once __DIR__ . '/PHPMailer/src/Exception.php';
            require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
            require_once __DIR__ . '/PHPMailer/src/SMTP.php';
        }
    }

    if (class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        $usedSmtp = true;
        try {
            // --- lead a te ---
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = $cfg['smtp_host'];
            $mail->SMTPAuth   = true;
            $mail->Username   = $cfg['smtp_user'];
            $mail->Password   = $cfg['smtp_pass'];
            $mail->SMTPSecure = $cfg['smtp_secure'] ?? 'ssl';
            $mail->Port       = (int)($cfg['smtp_port'] ?? 465);
            $mail->CharSet    = 'UTF-8';
            $mail->setFrom($FROM, $FROM_NAME);
            $mail->addAddress($TO);
            $mail->addReplyTo($cEmail, $cName);
            $mail->Subject = $leadSubject;
            $mail->Body    = $leadBody;
            $mail->send();
            $sentLead = true;

            // --- autoresponder al cliente ---
            $ack = new PHPMailer\PHPMailer\PHPMailer(true);
            $ack->isSMTP();
            $ack->Host       = $cfg['smtp_host'];
            $ack->SMTPAuth   = true;
            $ack->Username   = $cfg['smtp_user'];
            $ack->Password   = $cfg['smtp_pass'];
            $ack->SMTPSecure = $cfg['smtp_secure'] ?? 'ssl';
            $ack->Port       = (int)($cfg['smtp_port'] ?? 465);
            $ack->CharSet    = 'UTF-8';
            $ack->setFrom($FROM, $FROM_NAME);
            $ack->addAddress($cEmail, $cName);
            $ack->Subject = $autoSubject;
            $ack->Body    = $autoBody;
            @$ack->send();
        } catch (Exception $e) {
            $sentLead = false;
        }
    }
}

// ---- fallback mail() ----
if (!$sentLead) {
    $fromDomain = preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'dextlab.it');
    $h  = "From: $FROM_NAME <$FROM>\r\nReply-To: $cName <$cEmail>\r\n";
    $h .= "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $sentLead = @mail($TO, $leadSubject, $leadBody, $h);

    if ($sentLead) {
        $ah = "From: $FROM_NAME <$FROM>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        @mail($cEmail, $autoSubject, $autoBody, $ah);
    }
}

if ($sentLead) out(true, 'Messaggio inviato! Ti rispondo entro 24 ore.');
out(false, 'Invio non riuscito. Scrivimi direttamente a info@dextlab.it.', 500);
