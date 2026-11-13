# Runbook: Secret leak response

1. Rotate the leaked credential in the secret manager immediately.
2. Revoke any derived tokens; force re-auth where applicable.
3. Search logs/audit for usage of the leaked value; open incident.
4. Update PROVIDER_CREDENTIAL_KEY and re-encrypt stored credentials.
5. Post-mortem within 5 business days.
