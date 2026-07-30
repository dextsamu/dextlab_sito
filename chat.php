<?php
/**
 * Dext Lab — endpoint chatbot AI.
 * Riceve la conversazione, chiama l'LLM lato server (chiave mai esposta al client).
 * Se l'AI non è configurata, usa risposte rule-based di fallback.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/inc/db.php';
$cfg = dext_config();
// settings DB sovrascrivono config.php (admin panel)
foreach (settings_all() as $k => $v) {
    if (in_array($k, ['ai_enabled', 'ai_provider', 'ai_api_key', 'ai_model'], true)) $cfg[$k] = $v;
}

function out($reply, $code = 200) {
    http_response_code($code);
    echo json_encode(['reply' => $reply], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out('Metodo non consentito.', 405);
}

// anti-abuso: protegge l'endpoint LLM da attacchi-costo
if (!rate_limit('chat_min', 15, 60) || !rate_limit('chat_day', 150, 86400)) {
    out('Hai scritto molti messaggi in poco tempo. Riprova tra qualche minuto o scrivimi a info@dextlab.it.', 429);
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$messages = $data['messages'] ?? [];

// validazione base
if (!is_array($messages) || count($messages) === 0 || count($messages) > 20) {
    out('Messaggio non valido.', 422);
}
$lastUser = '';
foreach (array_reverse($messages) as $m) {
    if (($m['role'] ?? '') === 'user') { $lastUser = mb_substr(trim($m['content'] ?? ''), 0, 1000); break; }
}

// ---- knowledge di base per il bot ----
$system = "Sei l'assistente virtuale di Dext Lab, realtà che crea siti web, web app, soluzioni di Intelligenza Artificiale e offre consulenza informatica. "
    . "Rispondi in italiano, in modo cordiale, conciso e professionale (max 4 frasi). "
    . "Servizi: siti web e landing page, e-commerce, web app su misura, chatbot e automazioni AI, consulenza IT. "
    . "Prezzi indicativi: landing da ~490€, sito vetrina da ~990€, e-commerce da ~2500€, web app da ~4500€, soluzioni AI da ~1800€. "
    . "Tempi rapidi grazie all'uso di strumenti moderni e AI. Primo preventivo gratuito e senza impegno. "
    . "Invita a usare il configuratore di preventivo o a scrivere a info@dextlab.it / lasciare un contatto nel form. "
    . "Non inventare dettagli tecnici specifici non richiesti; se non sai, proponi di contattare Dext Lab.";

// ---- fallback rule-based se AI non configurata ----
if (empty($cfg['ai_enabled']) || empty($cfg['ai_api_key']) || $cfg['ai_api_key'] === 'INSERISCI_API_KEY') {
    $q = mb_strtolower($lastUser);
    if (strpos($q, 'prezz') !== false || strpos($q, 'costo') !== false || strpos($q, 'quanto') !== false) {
        out("Dipende dal progetto: landing da ~490€, sito vetrina da ~990€, e-commerce da ~2500€, web app da ~4500€, soluzioni AI da ~1800€. Prova il configuratore qui sopra per una stima, oppure scrivimi a info@dextlab.it!");
    }
    if (strpos($q, 'tempo') !== false || strpos($q, 'quanto ci') !== false || strpos($q, 'consegna') !== false) {
        out("Grazie agli strumenti moderni e all'AI consegno in fretta: una landing in pochi giorni, progetti più complessi in qualche settimana.");
    }
    if (strpos($q, 'ai') !== false || strpos($q, 'chatbot') !== false || strpos($q, 'intelligen') !== false) {
        out("Realizzo chatbot, automazioni e integrazioni AI sui tuoi dati aziendali. Proprio come questo assistente! Vuoi raccontarmi cosa ti serve?");
    }
    if (strpos($q, 'contatt') !== false || strpos($q, 'email') !== false || strpos($q, 'parlare') !== false) {
        out("Scrivimi a info@dextlab.it o lascia i tuoi dati nel form contatti: ti rispondo entro 24 ore.");
    }
    out("Ciao! Posso darti info su siti web, web app, soluzioni AI e consulenza. Chiedimi di prezzi, tempi o servizi, oppure scrivi a info@dextlab.it.");
}

// ---- chiamata LLM ----
$provider = $cfg['ai_provider'] ?? 'anthropic';
$apiMessages = [];
foreach ($messages as $m) {
    $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
    $content = mb_substr(trim($m['content'] ?? ''), 0, 1000);
    if ($content !== '') $apiMessages[] = ['role' => $role, 'content' => $content];
}

if ($provider === 'anthropic') {
    $payload = [
        'model'      => $cfg['ai_model'] ?? 'claude-haiku-4-5-20251001',
        'max_tokens' => 400,
        'system'     => $system,
        'messages'   => $apiMessages,
    ];
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'content-type: application/json',
            'x-api-key: ' . $cfg['ai_api_key'],
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $res = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode($res, true);
    $reply = $j['content'][0]['text'] ?? null;
    if ($http === 200 && $reply) out($reply);
    out("Al momento non riesco a rispondere. Scrivimi a info@dextlab.it e ti ricontatto!", 200);
}

// ---- OpenAI ----
$payload = [
    'model'    => $cfg['ai_model'] ?? 'gpt-4o-mini',
    'messages' => array_merge([['role' => 'system', 'content' => $system]], $apiMessages),
    'max_tokens' => 400,
];
$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'content-type: application/json',
        'authorization: Bearer ' . $cfg['ai_api_key'],
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
]);
$res = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$j = json_decode($res, true);
$reply = $j['choices'][0]['message']['content'] ?? null;
if ($http === 200 && $reply) out($reply);
out("Al momento non riesco a rispondere. Scrivimi a info@dextlab.it e ti ricontatto!", 200);
