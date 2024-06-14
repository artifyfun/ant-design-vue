const glob = require('glob');
const fs = require('fs');

const ignoreTags = [
  'flex',
  'grid',
  'layout',
  'layout-sider',
  'space',
  'space-compact',
  'icon',
  'common',
  'custom',
  'list-item-meta',
  'menu-item-type',
  'sub-menu-type',
  'menu-item-group-type',
  'menu-divider-type',
  'tag-checkable-tag',
  'anchor-link',
  'auto-complete-opt-group',
  'auto-complete-option',
  // 'avatar-group',
  '自定义',
  'sub-menu',
  'tour-step',
];

function getComponents(type = 'zh-CN') {
  const ignoreFiles = ignoreTags.map(tag => `**/${tag}/index.${type}.md*`);
  // get components all zh-CN md files
  const mdFiles = glob.sync(`components/**/index.${type}.md*`, {
    ignore: ignoreFiles,
  });

  const components = mdFiles.map(file => {
    const content = fs.readFileSync(file, 'utf8');
    const headerContent = content.split('---')[1];
    const headerArr = headerContent
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);
    const header = Object.fromEntries(
      headerArr.map(item => {
        const key = item.split(':')[0];
        const value = item.split(`${key}:`)[1];
        return [key.trim(), value?.trim()];
      }),
    );
    const descriptionContent = content.split('---')[2].split('#')[0].trim();

    return {
      ...header,
      description: descriptionContent || header.subtitle,
    };
  });

  return components;
}

module.exports = {
  ignoreTags,
  getComponents,
};
