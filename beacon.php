<?php
/** Beacon: marca una visita come "umana" (i bot raramente eseguono JS). */
require_once __DIR__ . '/inc/db.php';

$t = $_GET['t'] ?? ($_POST['t'] ?? '');
if (rate_limit('beacon', 90, 60)) {
    mark_human($t);
}
http_response_code(204); // No Content
