#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/kktapp/kkt-system')

from backend.config import settings

print(f"RAW: {settings.telegram_admin_ids}")
print(f"LIST: {settings.telegram_admin_ids_list}")
