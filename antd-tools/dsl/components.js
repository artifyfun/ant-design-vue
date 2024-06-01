const glob = require('glob');
const fs = require('fs');

function getComponents(type = 'zh-CN') {
  const ignoreFiles = [
    `**/flex/index.${type}.md*`,
    `**/grid/index.${type}.md*`,
    `**/layout/index.${type}.md*`,
    `**/space/index.${type}.md*`,
    `**/app/index.${type}.md*`,
    `**/icon/index.${type}.md*`,
    `**/form/index.${type}.md*`,
    `**/breadcrumb/index.${type}.md*`,
    `**/menu/index.${type}.md*`,
  ];
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

module.exports = getComponents;
