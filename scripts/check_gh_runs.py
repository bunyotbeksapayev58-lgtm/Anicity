import os
import urllib.request
import json

repo = os.environ.get('GITHUB_REPOSITORY', 'owner/repo')
url = f'https://api.github.com/repos/{repo}/actions/runs'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print('Total runs:', data.get('total_count'))
        runs = data.get('workflow_runs', [])
        for r in runs[:10]:
            print(f"Run ID: {r.get('id')}, Name: '{r.get('name')}', Status: {r.get('status')}, Conclusion: {r.get('conclusion')}, SHA: {r.get('head_sha')[:7]}, CreatedAt: {r.get('created_at')}")
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read().decode()[:200])
except Exception as e:
    print('Error:', e)
