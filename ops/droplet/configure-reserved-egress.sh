#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Uso: %s IP_RESERVADA\n' "$0" >&2
  exit 2
fi

reserved_ip="$1"
metadata='http://169.254.169.254/metadata/v1/interfaces/public/0'
anchor_gateway="$(curl -fsS --max-time 5 "$metadata/anchor_ipv4/gateway")"
original_gateway="$(curl -fsS --max-time 5 "$metadata/ipv4/gateway")"
netplan_file='/etc/netplan/50-cloud-init.yaml'

if ! grep -Fq "via: \"$anchor_gateway\"" "$netplan_file"; then
  if ! grep -Fq "via: \"$original_gateway\"" "$netplan_file"; then
    printf 'No se reconoce la ruta predeterminada en %s\n' "$netplan_file" >&2
    exit 1
  fi
  cp --update=none "$netplan_file" "$netplan_file.original"
  sed -i "s/via: \"$original_gateway\"/via: \"$anchor_gateway\"/" "$netplan_file"
fi

# cloud-init regeneraria el archivo de Netplan si no se desactiva su red.
printf '%s\n' 'network: {config: disabled}' \
  > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
netplan generate
netplan apply

actual_ip="$(curl -4 -fsS --max-time 10 https://api.ipify.org)"
if [[ "$actual_ip" != "$reserved_ip" ]]; then
  printf 'Salida inesperada: %s; se esperaba %s\n' "$actual_ip" "$reserved_ip" >&2
  exit 1
fi
printf 'IP de salida verificada: %s\n' "$actual_ip"
