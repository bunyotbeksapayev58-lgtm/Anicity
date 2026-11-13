import os
import urllib.request
import json

repo = os.environ.get('GITHUB_REPOSITORY', 'owner/repo')
run_id = os.environ.get('GITHUB_RUN_ID', '12345678')
url = f'https://api.github.com/repos/{repo}/actions/runs/{run_id}/jobs'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        jobs = data.get('jobs', [])
        for j in jobs:
            print(f"Job ID: {j.get('id')}, Name: '{j.get('name')}', Status: {j.get('status')}, Conclusion: {j.get('conclusion')}")
            for s in j.get('steps', []):
                print(f"  - Step: '{s.get('name')}', Status: {s.get('status')}, Conclusion: {s.get('conclusion')}, Duration: {s.get('completed_at')}")
except Exception as e:
    print('Error:', e)
