import json
import os
import yaml
from datetime import datetime

# 读取Bangumi数据
with open('../data/bangumi.json', 'r', encoding='utf-8') as f:
    bangumi_data = json.load(f)

# 确保content/library目录存在
os.makedirs('../content/library', exist_ok=True)

# 清空现有内容（保留_index.md）
for item in os.listdir('../content/library'):
    if item != '_index.md' and os.path.isdir(f'../content/library/{item}'):
        os.system(f'rm -rf ../content/library/{item}')

# 为每个番剧创建Markdown文件
for item in bangumi_data:
    subject = item['subject']
    subject_id = subject['id']
    
    # 创建目录
    dir_name = f"../content/library/{subject_id}"
    os.makedirs(dir_name, exist_ok=True)
    
    # 准备Front Matter
    front_matter = {
        'title': subject['name'],
        'name_cn': subject['name_cn'],
        'date': datetime.strptime(item['updated_at'], '%Y-%m-%dT%H:%M:%S+08:00').strftime('%Y-%m-%d'),
        'author': ', '.join([tag['name'] for tag in subject['tags'][:3]]),
        'score': subject['score'],
        'rate': item['rate'],
        'ep_status': item['ep_status'],
        'eps': subject['eps'],
        'subject_id': subject_id,
        'images': subject['images'],
        'tags': item['tags'] + [tag['name'] for tag in subject['tags'][:5]],
        'summary': subject['short_summary']
    }
    
    # 写入Markdown文件
    with open(f'{dir_name}/index.md', 'w', encoding='utf-8') as f:
        f.write('---\n')
        yaml.dump(front_matter, f, allow_unicode=True)
        f.write('---\n\n')
        f.write(f"![{subject['name_cn']}]({subject['images']['common']})\n\n")
        f.write(subject['short_summary'] + '\n\n')
        f.write(f"View more details on [Bangumi](https://bgm.tv/subject/{subject_id})")

print(f"已生成 {len(bangumi_data)} 个番剧页面")
