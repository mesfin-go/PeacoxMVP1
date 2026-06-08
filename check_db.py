import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXpxa3R2a3Z5ZnljeXJocmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA2OTUsImV4cCI6MjA5NjExNjY5NX0.oDSGz97-15p3OFhHTPALbgnJ1lDRJNBM9ayA17uF2Lc",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXpxa3R2a3Z5ZnljeXJocmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA2OTUsImV4cCI6MjA5NjExNjY5NX0.oDSGz97-15p3OFhHTPALbgnJ1lDRJNBM9ayA17uF2Lc"
}

tables = ["profiles", "gab_metrics", "engagement_plans", "idp_goals", "mentor_profiles", "calendar_notes"]

for t in tables:
    try:
        req = urllib.request.Request(f"https://lgmzqktvkvyfycyrhrbt.supabase.co/rest/v1/{t}?select=*&limit=1", headers=headers)
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"{t} - EXISTS")
    except urllib.error.HTTPError as e:
        print(f"{t} - HTTP Error {e.code}")
    except Exception as e:
        print(f"{t} - Error: {e}")

try:
    req = urllib.request.Request(f"https://lgmzqktvkvyfycyrhrbt.supabase.co/storage/v1/bucket", headers=headers)
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode('utf-8'))
        ids = [b['id'] for b in data]
        print("Buckets -", ", ".join(ids) if ids else "None")
except urllib.error.HTTPError as e:
    print(f"Buckets - HTTP Error {e.code}")
except Exception as e:
    print(f"Buckets - Error: {e}")
