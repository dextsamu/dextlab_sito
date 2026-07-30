<!DOCTYPE html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin — Dext Lab</title>
<link rel="stylesheet" href="admin.css">
</head><body class="login-page">
<form class="login-box" method="post">
  <h1>Dext Lab <span>admin</span></h1>
  <?php if (!empty($err)): ?><p class="err"><?= e($err) ?></p><?php endif; ?>
  <label>Username</label>
  <input name="username" autocomplete="username" required autofocus>
  <label>Password</label>
  <input name="password" type="password" autocomplete="current-password" required>
  <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
  <button type="submit">Accedi</button>
</form>
</body></html>
