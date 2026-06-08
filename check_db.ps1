$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXpxa3R2a3Z5ZnljeXJocmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA2OTUsImV4cCI6MjA5NjExNjY5NX0.oDSGz97-15p3OFhHTPALbgnJ1lDRJNBM9ayA17uF2Lc"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXpxa3R2a3Z5ZnljeXJocmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA2OTUsImV4cCI6MjA5NjExNjY5NX0.oDSGz97-15p3OFhHTPALbgnJ1lDRJNBM9ayA17uF2Lc"
}
$tables = @("profiles", "gab_metrics", "engagement_plans", "idp_goals", "mentor_profiles", "calendar_notes")
foreach ($t in $tables) {
    try {
        $res = Invoke-RestMethod -Uri "https://lgmzqktvkvyfycyrhrbt.supabase.co/rest/v1/$t`?select=*&limit=1" -Headers $headers -Method Get
        Write-Output "$t - EXISTS"
    } catch {
        Write-Output "$t - DOES NOT EXIST ($($_.Exception.Message))"
    }
}
try {
    $res = Invoke-RestMethod -Uri "https://lgmzqktvkvyfycyrhrbt.supabase.co/storage/v1/bucket" -Headers $headers -Method Get
    Write-Output "Buckets - $($res.id -join ', ')"
} catch {
    Write-Output "Buckets - ERROR ($($_.Exception.Message))"
}
