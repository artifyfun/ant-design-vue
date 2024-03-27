const path = require('path');
const pkg = require('../../package.json');
const { parseAndWrite } = require('../generator-types/lib/index.js');
const rootPath = path.resolve(__dirname, '../../');

const { outputFileSync, readFileSync } = require('fs-extra');

const tagPrefix = '';

const tagDemo = {
  name: 'collapse',
  slots: [
    {
      name: 'expandIcon',
      description: '自定义切换图标',
    },
  ],
  events: [],
  attributes: [
    {
      name: 'accordion',
      default: '`false`',
      description: '手风琴模式',
      value: {
        type: 'boolean',
        kind: 'expression',
      },
    },
    {
      name: 'activeKey(v-model)',
      default: '默认无，accordion 模式下默认第一个元素',
      description: '当前激活 tab 面板的 key',
      value: {
        type: 'string[] | string <br> number[] | number',
        kind: 'expression',
      },
    },
    {
      name: 'bordered',
      default: '`true`',
      description: '带边框风格的折叠面板',
      value: {
        type: 'boolean',
        kind: 'expression',
      },
    },
    {
      name: 'collapsible',
      default: '-',
      description: '所有子面板是否可折叠或指定可折叠触发区域',
      value: {
        type: '`header` | `icon` | `disabled`',
        kind: 'expression',
      },
    },
    {
      name: 'destroyInactivePanel',
      default: '`false`',
      description: '销毁折叠隐藏的面板',
      value: {
        type: 'boolean',
        kind: 'expression',
      },
    },
    {
      name: 'expandIcon',
      default: '',
      description: '自定义切换图标',
      value: {
        type: 'Function(props):VNode | slot="expandIcon" slot-scope="props"|#expandIcon="props"',
        kind: 'expression',
      },
    },
    {
      name: 'expandIconPosition',
      default: '-',
      description: '设置图标位置',
      value: {
        type: '`start` | `end`',
        kind: 'expression',
      },
    },
    {
      name: 'ghost',
      default: 'false',
      description: '使折叠面板透明且无边框',
      value: {
        type: 'boolean',
        kind: 'expression',
      },
    },
  ],
};

parseAndWrite({
  version: pkg.version,
  name: 'ant-design-vue',
  path: path.resolve(rootPath, './components'),
  typingsPath: path.resolve(rootPath, './typings/global.d.ts'),
  // default match lang
  // test: /en-US\.md/,
  test: /zh-CN\.md/,
  outputDir: path.resolve(rootPath, './dsl/metadata/'),
  tagPrefix,
})
  .then(result => {
    // eslint-disable-next-line no-console
    console.log(`generator types success: ${result} tags generated`);

    // const webTypes = require(path.resolve(rootPath, './dsl/metadata/web-types.json'));

    const components = require('./components.js');

    Object.keys(components).map(name => {
      const component = components[name];
      const tag = webTypes.contributions.html.tags.find(tag => tag.name === name);
      if (!tag) {
        console.error(`tag ${name} not found`);
        return;
      }
      return {
        id: 1,
        version: webTypes.version,
        name: {
          zh_CN: component.subtitle,
        },
        component: `A${component.title}`,
        icon: component.icon || name,
        description: component.description,
        doc_url: '',
        screenshot: components.coverDark,
        tags: '',
        keywords: '',
        dev_mode: 'proCode',
        npm: {
          package: pkg.name,
          version: '2.4.2',
          script: `https://unpkg.com/browse/${pkg.name}@${pkg.version}/dist/antd.esm.min.js`,
          css: `https://unpkg.com/browse/${pkg.name}@${pkg.version}/dist/reset.css`,
          dependencies: null,
          exportName: component.title,
        },
        group: 'component',
        category: component.type,
        configure: {
          loop: true,
          condition: true,
          styles: true,
          isContainer: false,
          isModal: false,
          isPopper: false,
          nestingRule: {
            childWhitelist: '',
            parentWhitelist: '',
            descendantBlacklist: '',
            ancestorWhitelist: '',
          },
          isNullNode: false,
          isLayout: false,
          rootSelector: '',
          shortcuts: {
            properties: [
              // 组件可以在画布快捷配置的属性
              // "type",
              // "size"
            ],
          },
          contextMenu: {
            actions: ['copy', 'remove', 'insert', 'updateAttr', 'bindEevent', 'createBlock'],
            disable: [],
          },
          invalidity: [''],
          clickCapture: true,
          framework: 'Vue',
        },
        schema: {
          properties: [
            {
              name: '0',
              label: {
                zh_CN: '基础属性',
              },
              content: [
                ...tag.attributes
                  .map(attr => {
                    const allowedTypes = ['string', 'number', 'boolean', 'object'];
                    let type = attr.value.type.includes('|')
                      ? attr.value.type.split('|').map(item => item.trim())[0]
                      : attr.value.type;
                    if (type.includes('`')) {
                      type = 'string';
                    }
                    if (['CSSProperties', 'array'].includes(type)) {
                      type = 'object';
                    }
                    if (!allowedTypes.some(item => type.includes(item))) {
                      return null;
                    }
                    const defaultValue = (() => {
                      if (['无', '-'].includes(attr.default)) {
                        return undefined;
                      }
                      if (['boolean'].includes(type)) {
                        return typeof attr.default === 'string'
                          ? attr.default.includes('true')
                            ? true
                            : attr.default.includes('false')
                            ? false
                            : undefined
                          : undefined;
                      }
                      if (['number'].includes(type)) {
                        return typeof attr.default === 'string'
                          ? Number(attr.default)
                          : attr.default;
                      }
                      if (['object'].includes(type)) {
                        return typeof attr.default === 'string'
                          ? JSON.parse(attr.default)
                          : undefined;
                      }
                      return attr.default;
                    })();
                    const widget = (() => {
                      if (type === 'boolean') {
                        return {
                          component: 'MetaSwitch',
                          props: {},
                        };
                      }
                      if (type === 'string') {
                        return {
                          component: 'MetaInput',
                          props: {},
                        };
                      }
                      if (type === 'number') {
                        return {
                          component: 'MetaNumber',
                          props: {},
                        };
                      }
                      if (type === 'object') {
                        return {
                          component: 'MetaCodeEditor',
                          props: {
                            language: 'json',
                          },
                        };
                      }
                    })();
                    return {
                      property: attr.name,
                      label: {
                        text: {
                          zh_CN: attr.name,
                        },
                      },
                      description: {
                        zh_CN: attr.description,
                      },
                      required: false,
                      readOnly: false,
                      disabled: false,
                      cols: 12,
                      labelPosition: 'top',
                      type: type,
                      defaultValue: defaultValue,
                      widget: widget,
                      device: [],
                    };
                  })
                  .filter(Boolean),
              ],
              description: {
                zh_CN: '',
              },
            },
          ],
          events: {},
          slots: {
            default: {
              label: {
                zh_CN: 'default',
              },
              description: {
                zh_CN: '自定义默认内容',
              },
            },
            loading: {
              label: {
                zh_CN: 'loading',
              },
              description: {
                zh_CN: '自定义加载中组件',
              },
            },
          },
        },
        snippets: [
          {
            name: {
              zh_CN: '按钮',
            },
            icon: 'button',
            screenshot: '',
            snippetName: 'ElButton',
            schema: {
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: '按钮文本',
                  },
                },
              ],
            },
          },
        ],
      };
    });

    // outputFileSync(
    //   path.resolve(rootPath, `./dsl/components/tiny-engine/${component.name}.json`),
    //   result
    // );
  })
  .catch(error => {
    console.error('generator types error', error);
    return Promise.reject(error);
  });
