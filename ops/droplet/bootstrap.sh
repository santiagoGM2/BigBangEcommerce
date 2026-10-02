#!/usr/bin/env bash
set -euo pipefail

admin_user="bigbang"

if ! id "$admin_user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$admin_user"
fi
usermod --append --groups sudo "$admin_user"
install -d -m 700 -o "$admin_user" -g "$admin_user" "/home/$admin_user/.ssh"
if [[ ! -f "/home/$admin_user/.ssh/authorized_keys" ]]; then
  install -m 600 -o "$admin_user" -g "$admin_user" \
    /root/.ssh/authorized_keys "/home/$admin_user/.ssh/authorized_keys"
fi
printf '%s\n' "$admin_user ALL=(ALL) NOPASSWD:ALL" \
  > "/etc/sudoers.d/90-$admin_user"
chmod 440 "/etc/sudoers.d/90-$admin_user"
visudo --check >/dev/null

# Un poco de swap protege al proxy de picos de memoria en el plan de 512 MB.
if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
fi
if ! grep -Fq '/swapfile none swap sw 0 0' /etc/fstab; then
  printf '%s\n' '/swapfile none swap sw 0 0' >> /etc/fstab
fi
printf '%s\n' 'vm.swappiness=10' > /etc/sysctl.d/90-bigbang-memory.conf
sysctl --system >/dev/null

# Limitar los registros para no llenar el disco de 10 GB.
install -d -m 755 /etc/systemd/journald.conf.d
printf '%s\n' '[Journal]' 'SystemMaxUse=100M' \
  > /etc/systemd/journald.conf.d/90-bigbang.conf
systemctl restart systemd-journald

printf 'Usuario: %s\n' "$admin_user"
free -m
df -h /
