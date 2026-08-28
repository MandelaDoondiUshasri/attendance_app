import os

for root, _, files in os.walk('e:/projects/frgattendance/frontend/src'):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replacements
            new_content = content.replace("user?.role === 'CEO'", "(['CEO', 'SYSTEM_ADMIN'].includes(user?.role))")
            new_content = new_content.replace("user?.role !== 'CEO'", "(!['CEO', 'SYSTEM_ADMIN'].includes(user?.role))")
            new_content = new_content.replace("['HR', 'CEO'].includes(user?.role)", "['HR', 'CEO', 'SYSTEM_ADMIN'].includes(user?.role)")
            new_content = new_content.replace("['CEO', 'HR'].includes(user?.role)", "['HR', 'CEO', 'SYSTEM_ADMIN'].includes(user?.role)")
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {path}')
print('Done')
