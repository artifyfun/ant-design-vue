const glob = require('glob');
const fs = require('fs');

const ignoreFiles = [];

// get components all zh-CN md files
const mdFiles = glob.sync('components/**/index.zh-CN.md*', {
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
      const [key, value] = item.split(':');
      return [key.trim(), value?.trim()];
    }),
  );
  const descriptionContent = content.split('---')[2].split('#')[0].trim();

  return {
    ...header,
    description: descriptionContent || header.subtitle,
  };
});

module.exports = components;
