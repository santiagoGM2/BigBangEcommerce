#!/usr/bin/env bash
set -euo pipefail

# Ejecutar solamente despues de comprobar acceso SSH y sudo como bigbang.
cat > /etc/ssh/sshd_config.d/90-bigbang.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
EOF
sshd -t
systemctl reload ssh
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication) '
