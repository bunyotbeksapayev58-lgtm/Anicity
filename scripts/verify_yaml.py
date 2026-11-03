import yaml

with open('.github/workflows/qa-regression.yml', 'r', encoding='utf-8') as f:
    parsed = yaml.safe_load(f)

print('YAML_VALIDATION: SUCCESS')
print('Workflow Name:', parsed.get('name'))
print('Triggers:', parsed.get('on'))
print('Jobs:', list(parsed.get('jobs', {}).keys()))
steps = parsed.get('jobs', {}).get('qa-regression-and-audit', {}).get('steps', [])
print('Steps count:', len(steps))
for i, s in enumerate(steps):
    print(f"  Step {i+1}: {s.get('name')}")
