import urllib.request
import json

run_id = 41614994178
url = f'https://api.github.com/repos/bunyotbeksapayev58-lgtm/Anicity/actions/runs/{run_id}/jobs'
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
