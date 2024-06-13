const path = require('path');
const pkg = require('../../package.json');
const { parseAndWrite } = require('../generator-types/lib/index.js');
const rootPath = path.resolve(__dirname, '../../');
const { getComponents, ignoreTags } = require('./components.js');
const _ = require('lodash');

function toKebabCase(camel) {
  return camel.replace(/((?<=[a-z\d])[A-Z]|(?<=[A-Z\d])[A-Z](?=[a-z]))/g, '-$1').toLowerCase();
}

function formatConversion(str, num = 0) {
  const arr = str.split('-');
  for (let i = 0; i < arr.length; i += 1) {
    if (i === 0 && num === 1) {
      arr[i] = arr[i].charAt(0).toLowerCase() + arr[i].substring(1).toLowerCase();
    } else {
      arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].substring(1).toLowerCase();
    }
  }
  return arr.join('');
}

const { outputFileSync, readFileSync } = require('fs-extra');

const tagPrefix = '';

const CDN = '/assets/lib';

const category = 'Ant Design Vue';

function parseAndWriteByType(type = 'zh-CN') {
  const reg = new RegExp(`${type}.md`);
  return parseAndWrite({
    version: pkg.version,
    name: 'ant-design-vue',
    path: path.resolve(rootPath, './components'),
    typingsPath: path.resolve(rootPath, './typings/global.d.ts'),
    // default match lang
    test: reg,
    // test: /zh-CN\.md/,
    outputDir: path.resolve(rootPath, `./dsl/metadata/${type}`),
    tagPrefix,
  });
}

function getPropertiesContent(attributes) {
  return attributes
    .map(attr => {
      const allowedTypes = ['string', 'number', 'boolean', 'object', 'function'];
      const formatVariable = word => {
        let res = word;
        ["'", '"', '`'].forEach(item => (res = res.replaceAll(item, '')));
        return res.trim();
      };
      const isValidVariable = word =>
        /^([^\x00-\xff]|[a-zA-Z_$])([^\x00-\xff]|[a-zA-Z0-9_$])*$/.test(formatVariable(word)) &&
        !['string', 'number', 'boolean', 'object', 'slot', 'function', 'VNode'].some(key =>
          word.toLowerCase().includes(key.toLowerCase()),
        );

      let type = attr.value.type.includes('|')
        ? attr.value.type
            .split('|')
            .map(item => item.trim())[0]
            .toLowerCase()
        : attr.value.type.toLowerCase();
      if (["'", '"', '`'].some(item => type.includes(item)) && isValidVariable(type)) {
        type = 'string';
      }
      if (['CSSProperties', 'array', 'string[]', 'number[]'].includes(type)) {
        type = 'object';
      }
      if (type.toLowerCase().includes('function')) {
        type = 'function';
      }

      if (!allowedTypes.some(item => item === type)) {
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
          if (attr.default === '') {
            return undefined;
          }
          return attr.default && typeof attr.default === 'string'
            ? Number(attr.default)
            : attr.default;
        }
        if (['object'].includes(type)) {
          try {
            return JSON.parse(attr.default);
          } catch (error) {
            return undefined;
          }
        }
        const value =
          attr.default && typeof attr.default === 'string'
            ? attr.default.replaceAll('`', '').replaceAll('"', '').replaceAll("'", '').trim()
            : attr.default;
        return value === '-' ? undefined : value;
      })();

      const widget = (() => {
        if (type === 'boolean') {
          return {
            component: 'MetaSwitch',
            props: {},
          };
        }
        if (type === 'string') {
          if (
            attr.value.type.includes('|') &&
            attr.value.type.split('|').every(item => isValidVariable(item))
          ) {
            return {
              component: 'MetaSelect',
              props: {
                options: attr.value.type
                  .split('|')
                  .map(item => formatVariable(item))
                  .map(item => ({
                    label: item,
                    value: item,
                  })),
              },
            };
          }
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
        if (type === 'function') {
          return {
            component: 'MetaCodeEditor',
            props: {},
          };
        }
      })();

      return {
        property: attr.name.replace('(v-model)', '').trim(),
        label: {
          text: {
            zh_CN: attr.name,
          },
        },
        description: {
          zh_CN: formatDescription(attr.description),
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
    .filter(Boolean);
}

function getEvents(events) {
  return Object.fromEntries(
    events.map(event => {
      const name = `on${event.name.replace(/(^[a-z])/, char => char.toUpperCase())}`;
      return [
        name,
        {
          label: {
            zh_CN: name,
          },
          description: {
            zh_CN: formatDescription(event.description),
          },
          type: 'event',
          functionInfo: {
            params: [],
            returns: {},
          },
          defaultValue: '',
        },
      ];
    }),
  );
}

function getSlots(slots) {
  return Object.fromEntries(
    slots.map(slot => {
      const slotName = slot.name.startsWith('default') ? 'default' : slot.name;
      return [
        slotName,
        {
          label: {
            zh_CN: slotName,
          },
          description: {
            zh_CN: formatDescription(slot.description),
          },
        },
      ];
    }),
  );
}

function getSnippets(component) {
  const schemaMap = {
    Button: {
      componentName: 'AButton',
      children: [
        {
          componentName: 'Text',
          props: {
            text: '按钮文本',
          },
        },
      ],
    },
    Breadcrumb: {
      componentName: 'ABreadcrumb',
      children: [
        {
          componentName: 'ABreadcrumbItem',
          props: {
            text: '一级',
          },
        },
        {
          componentName: 'ABreadcrumbItem',
          props: {
            text: '二级',
          },
        },
      ],
    },
    Dropdown: {
      componentName: 'ADropdown',
      children: [
        {
          componentName: 'AButton',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '下拉菜单',
              },
            },
          ],
        },
        {
          componentName: 'Template',
          props: {
            slot: 'overlay',
          },
          children: [
            {
              componentName: 'AMenu',
              children: [
                {
                  componentName: 'AMenuItem',
                  children: [
                    {
                      componentName: 'Text',
                      props: {
                        text: '选项一',
                      },
                    },
                  ],
                },
                {
                  componentName: 'AMenuItem',
                  children: [
                    {
                      componentName: 'Text',
                      props: {
                        text: '选项二',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    DropdownButton: {
      componentName: 'ADropdownButton',
      children: [
        {
          componentName: 'Text',
          props: {
            text: '下拉菜单',
          },
        },
        {
          componentName: 'Template',
          props: {
            slot: 'overlay',
          },
          children: [
            {
              componentName: 'AMenu',
              children: [
                {
                  componentName: 'AMenuItem',
                  children: [
                    {
                      componentName: 'Text',
                      props: {
                        text: '选项一',
                      },
                    },
                  ],
                },
                {
                  componentName: 'AMenuItem',
                  children: [
                    {
                      componentName: 'Text',
                      props: {
                        text: '选项二',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    Menu: {
      componentName: 'AMenu',
      props: {
        items: [
          {
            key: 'mail',
            label: 'Navigation One',
            title: 'Navigation One',
          },
          {
            key: 'app',
            label: 'Navigation Two',
            title: 'Navigation Two',
          },
        ],
      },
    },
    Steps: {
      componentName: 'ASteps',
      props: {
        items: [
          {
            title: 'Finished',
            description: 'This is a description.',
          },
          {
            title: 'In Progress',
            description: 'This is a description.',
            subTitle: 'Left 00:00:08',
          },
          {
            title: 'Waiting',
            description: 'This is a description.',
          },
        ],
      },
    },
    Cascader: {
      componentName: 'ACascader',
      props: {
        options: [
          {
            value: 'zhejiang',
            label: 'Zhejiang',
            children: [
              {
                value: 'hangzhou',
                label: 'Hangzhou',
                children: [
                  {
                    value: 'xihu',
                    label: 'West Lake',
                  },
                ],
              },
            ],
          },
          {
            value: 'jiangsu',
            label: 'Jiangsu',
            children: [
              {
                value: 'nanjing',
                label: 'Nanjing',
                children: [
                  {
                    value: 'zhonghuamen',
                    label: 'Zhong Hua Men',
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    Checkbox: {
      componentName: 'ACheckbox',
      children: [
        {
          componentName: 'Text',
          props: {
            text: 'Checkbox',
          },
        },
      ],
    },
    Form: {
      componentName: 'AForm',
      children: [
        {
          componentName: 'AFormItem',
          children: [
            {
              componentName: 'AInput',
            },
          ],
        },
      ],
    },
    Radio: {
      componentName: 'ARadio',
      children: [
        {
          componentName: 'Text',
          props: {
            text: 'Radio',
          },
        },
      ],
    },
    Select: {
      componentName: 'ASelect',
      children: [
        {
          componentName: 'ASelectOption',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '选项一',
              },
            },
          ],
        },
        {
          componentName: 'ASelectOption',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '选项二',
              },
            },
          ],
        },
      ],
    },
    TreeSelect: {
      componentName: 'ATreeSelect',
      props: {
        'tree-data': [
          {
            label: 'root 1',
            value: 'root 1',
            children: [
              {
                label: 'parent 1',
                value: 'parent 1',
                children: [
                  {
                    label: 'parent 1-0',
                    value: 'parent 1-0',
                    children: [
                      {
                        label: 'my leaf',
                        value: 'leaf1',
                      },
                      {
                        label: 'your leaf',
                        value: 'leaf2',
                      },
                    ],
                  },
                  {
                    label: 'parent 1-1',
                    value: 'parent 1-1',
                  },
                ],
              },
              {
                label: 'parent 2',
                value: 'parent 2',
              },
            ],
          },
        ],
      },
    },
    Upload: {
      componentName: 'AUpload',
      children: [
        {
          componentName: 'AButton',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '上传文件',
              },
            },
          ],
        },
      ],
    },
    Avatar: {
      componentName: 'AAvatar',
      children: [
        {
          componentName: 'Text',
          props: {
            text: 'U',
          },
        },
      ],
    },
    Badge: {
      componentName: 'ABadge',
      props: {
        count: '5',
      },
      children: [
        {
          componentName: 'AAvatar',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'U',
              },
            },
          ],
        },
      ],
    },
    Card: {
      componentName: 'ACard',
      children: [
        {
          componentName: 'Template',
          props: {
            slot: 'extra',
          },
          children: [
            {
              componentName: 'a',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: 'more',
                  },
                },
              ],
            },
          ],
        },
        {
          componentName: 'Text',
          props: {
            text: 'Card Content',
          },
        },
      ],
    },
    Carousel: {
      componentName: 'ACarousel',
      children: [
        {
          componentName: 'div',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '1',
              },
            },
          ],
        },
        {
          componentName: 'div',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '2',
              },
            },
          ],
        },
      ],
    },
    Collapse: {
      componentName: 'ACollapse',
      children: [
        {
          componentName: 'ACollapsePanel',
          children: [
            {
              componentName: 'div',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: '1',
                  },
                },
              ],
            },
          ],
        },
        {
          componentName: 'ACollapsePanel',
          children: [
            {
              componentName: 'div',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: '2',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    Descriptions: {
      componentName: 'ADescriptions',
      props: {
        title: 'UserInfo',
      },
      children: [
        {
          componentName: 'ADescriptionsItem',
          props: {
            label: 'UserName',
          },
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'Artifyfun',
              },
            },
          ],
        },
        {
          componentName: 'ADescriptionsItem',
          props: {
            label: 'Telephone',
          },
          children: [
            {
              componentName: 'Text',
              props: {
                text: '133xxxxxxxxx',
              },
            },
          ],
        },
      ],
    },
    List: {
      componentName: 'AList',
      props: {
        dataSource: [
          {
            title: 'Ant Design List Title 1',
          },
          {
            title: 'Ant Design List Title 2',
          },
        ],
      },
      children: [
        {
          componentName: 'Template',
          props: {
            slot: 'renderItem',
          },
          children: [
            {
              componentName: 'AListItem',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: 'item',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    Modal: {
      componentName: 'AModal',
      props: {
        open: true,
        title: 'Modal title',
      },
      children: [
        {
          componentName: 'div',
        },
      ],
    },
    Tabs: {
      componentName: 'ATabs',
      children: [
        {
          componentName: 'ATabPane',
          props: {
            tab: 'tab 1',
            key: '1',
          },
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'tab 1',
              },
            },
          ],
        },
        {
          componentName: 'ATabPane',
          props: {
            tab: 'tab 2',
            key: '2',
          },
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'tab 2',
              },
            },
          ],
        },
      ],
    },
    Tag: {
      componentName: 'ATag',
      children: [
        {
          componentName: 'Text',
          props: {
            text: '文本',
          },
        },
      ],
    },
    Timeline: {
      componentName: 'ATimeline',
      children: [
        {
          componentName: 'ATimelineItem',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'timeline 1',
              },
            },
          ],
        },
        {
          componentName: 'ATimelineItem',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'timeline 2',
              },
            },
          ],
        },
      ],
    },
    Tooltip: {
      componentName: 'ATooltip',
      children: [
        {
          componentName: 'Template',
          props: {
            slot: 'title',
          },
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'title content',
              },
            },
          ],
        },
        {
          componentName: 'Text',
          props: {
            text: '文本内容',
          },
        },
      ],
    },
  };

  return [
    {
      name: {
        zh_CN: component.subtitle,
      },
      icon: component.icon || toKebabCase(component.title),
      screenshot: '',
      snippetName: `A${component.title}`,
      schema: schemaMap[component.title] || {},
    },
  ];
}

function formatDescription(description = '') {
  return description
    .replaceAll('"', '')
    .replaceAll("'", '')
    .replaceAll('`', '')
    .replaceAll('\\', '');
}

const defaultSlotComponents = {
  AList: {
    renderItem: {
      label: {
        zh_CN: 'renderItem',
      },
      description: {
        zh_CN: '自定义内容',
      },
    },
  },
};

function mergeWebTypes(cn, en) {
  cn.contributions.html.tags = cn.contributions.html.tags.map(tag => {
    const enTag = en.contributions.html.tags.find(item => item.name === tag.name);
    if (!enTag) {
      return tag;
    }
    const slots = _.uniqBy([...tag.slots, ...enTag.slots], 'name');
    const events = _.uniqBy([...tag.events, ...enTag.events], 'name');
    const attributes = _.uniqBy([...tag.attributes, ...enTag.attributes], 'name');
    return {
      ...tag,
      slots,
      events,
      attributes,
    };
  });
  return cn;
}

const tagNameMap = {
  'steps-step': 'step',
  'anchor-item': 'anchor-link',
  'menu-sub-menu': 'sub-menu',
  'tabs-tab-pane': 'tab-pane',
  'radio-radio-button': 'radio-button',
};

function getTagName(tagName) {
  return tagNameMap[tagName] || tagName;
}

function getParentTagName(tagName) {
  return {
    'menu-sub-menu': 'menu',
    'directory-tree': 'tree',
  }[tagName];
}

async function generateMaterials(type = 'zh-CN') {
  await parseAndWriteByType(type);
  const cnWebTypes = require(path.resolve(rootPath, `./dsl/metadata/zh-CN/web-types.json`));
  const enWebTypes = require(path.resolve(rootPath, `./dsl/metadata/en-US/web-types.json`));

  const webTypes = type === 'zh-CN' ? mergeWebTypes(cnWebTypes, enWebTypes) : enWebTypes;

  const components = getComponents(type);

  const materials = webTypes.contributions.html.tags
    .filter(
      tag =>
        !ignoreTags.includes(tag.name) &&
        !['props'].some(subfix => tag.name.endsWith(subfix)) &&
        !['a-', 'aqr-'].some(prefix => tag.name.startsWith(prefix)),
    )
    .map(tag => {
      let component = components.find(
        component =>
          toKebabCase(component.title) === tag.name ||
          (tag.name === 'qrcode' && component.title === 'QRCode'),
      );
      if (!component) {
        const componentSubfix = [
          'step',
          'countdown',
          'item',
          'separator',
          'meta',
          'tab-pane',
          'panel',
          'radio-button',
          'button',
          'search',
          'password',
          'item-group',
          'group',
          'divider',
          'node',
          'text',
          'title',
          'paragraph',
          'file',
          'ribbon',
          'sub-menu',
        ];
        const subfix = componentSubfix.find(subfix => tag.name.endsWith(`-${subfix}`));
        if (subfix) {
          const parentTagName = getParentTagName(tag.name) || tag.name.replace(`-${subfix}`, '');
          const parentComponent = components.find(
            component => toKebabCase(component.title) === parentTagName,
          );
          if (parentComponent) {
            component = {
              ...parentComponent,
              title: formatConversion(getTagName(tag.name)),
            };
          }
        } else {
          const parentTagName = getParentTagName(tag.name);
          const parentComponent = components.find(
            component => toKebabCase(component.title) === parentTagName,
          );
          if (parentComponent) {
            component = {
              ...parentComponent,
              title: formatConversion(getTagName(tag.name)),
            };
          } else {
            console.log(tag);
          }
        }
      }
      if (!component) {
        console.log(tag);
      }
      return {
        id: 1,
        version: webTypes.version,
        name: {
          zh_CN: component.subtitle,
        },
        component: `A${component.title}`,
        icon: component.icon || toKebabCase(component.title),
        description: formatDescription(component.description),
        doc_url: '',
        screenshot: component.coverDark,
        tags: '',
        keywords: '',
        dev_mode: 'proCode',
        npm: {
          package: pkg.name,
          version: '',
          // version: webTypes.version,
          // script: `${CDN}/${pkg.name}@${pkg.version}/dist/antd.esm.min.js`,
          // css: `${CDN}/${pkg.name}@${pkg.version}/dist/reset.css`,
          dependencies: [
            'https://unpkg.com/dayjs/dayjs.min.js',
            'https://unpkg.com/dayjs/plugin/customParseFormat.js',
            'https://unpkg.com/dayjs/plugin/weekday.js',
            'https://unpkg.com/dayjs/plugin/localeData.js',
            'https://unpkg.com/dayjs/plugin/weekOfYear.js',
            'https://unpkg.com/dayjs/plugin/weekYear.js',
            'https://unpkg.com/dayjs/plugin/advancedFormat.js',
            'https://unpkg.com/dayjs/plugin/quarterOfYear.js',
          ],
          exportName: component.title,
          destructuring: true,
        },
        group: component.type,
        category,
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
              content: getPropertiesContent(tag.attributes),
              description: {
                zh_CN: '',
              },
            },
          ],
          events: getEvents(tag.events),
          slots: getSlots(tag.slots),
        },
        snippets: getSnippets(component),
      };
    });

  // 属性去重
  materials.forEach(material => {
    material.schema.properties = material.schema.properties.map(item => {
      item.content = item.content.filter(p => {
        const eventName = `on${p.property.replace(/(^[a-z])/, char => char.toUpperCase())}`;
        return !(Object.keys(material.schema.events).includes(eventName) && p.type === 'function');
      });
      return item;
    });
  });

  // 添加默认slot
  materials.forEach(material => {
    const defaultSlot = defaultSlotComponents[material.component];
    if (defaultSlot) {
      material.schema.slots = {
        ...defaultSlot,
        ...material.schema.slots,
      };
    }
  });

  // 弹窗属性设置
  materials.forEach(material => {
    const modalComponents = ['ADrawer', 'AModal'];
    if (modalComponents.includes(material.component)) {
      material.configure = {
        loop: true,
        condition: true,
        styles: true,
        isContainer: false,
        isModal: true,
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
          properties: ['visible', 'width'],
        },
        contextMenu: {
          actions: ['create symbol'],
          disable: ['copy', 'remove'],
        },
      };
    }
  });

  // 容器属性设置
  const containerComponents = [
    'AAffix',
    'AButton',
    'ABadge',
    'ABadgeRibbon',
    'ACard',
    'ACollapsePanel',
    'ADrawer',
    'ADropdown',
    'ADropdownButton',
    'AForm',
    'AFormItem',
    'AList',
    'AListItem',
    'AModal',
    'APopconfirm',
    'APopover',
    'ARadioButton',
    'ARadioGroup',
    'ATabs',
    'ATabPane',
    'ATag',
    'ATimeline',
    'ATimelineItem',
    'ATooltip',
    'AUpload',
  ];
  materials.forEach(material => {
    if (containerComponents.includes(material.component)) {
      material.configure.isContainer = true;
    }
  });

  materials.forEach(material => {
    outputFileSync(
      path.resolve(rootPath, `./dsl/materials/${material.component}.json`),
      JSON.stringify(material, null, 2),
    );
  });
}

generateMaterials('zh-CN');
