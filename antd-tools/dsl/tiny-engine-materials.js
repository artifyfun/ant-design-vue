const path = require('path');
const pkg = require('../../package.json');
const { parseAndWrite } = require('../generator-types/lib/index.js');
const rootPath = path.resolve(__dirname, '../../');
const { getComponents, ignoreTags } = require('./components.js');
const _ = require('lodash');

const componentPrefix = 'A';

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

function getType(string) {
  let type = string.includes('|')
    ? string
        .split('|')
        .map(item => item.trim())[0]
        .toLowerCase()
    : string.toLowerCase();
  if (["'", '"', '`'].some(item => type.includes(item)) && isValidVariable(type)) {
    type = 'string';
  }
  if (['CSSProperties', 'array', 'string[]', 'number[]'].includes(type)) {
    type = 'object';
  }
  if (type.toLowerCase().includes('function')) {
    type = 'function';
  }
  return type;
}

function getDefaultValue(attr, type) {
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
    return attr.default && typeof attr.default === 'string' ? Number(attr.default) : attr.default;
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
}

function getPropertiesContent(attributes) {
  return attributes
    .map(attr => {
      const allowedTypes = ['string', 'number', 'boolean', 'object', 'function'];

      const type = getType(attr.value.type);

      if (!allowedTypes.some(item => item === type)) {
        return null;
      }

      const defaultValue = getDefaultValue(attr, type);

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

      let attrName = attr.name.trim();

      if (attr.name.includes('v-model')) {
        if (attr.name.startsWith('v-model:')) {
          attrName = attr.name.replace('v-model:', '').trim();
        }
        if (attr.name.includes('(v-model)')) {
          attrName = attr.name.replace('(v-model)', '').trim();
        }
      }

      return {
        property: attrName,
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

function getEvents(events, attributes) {
  attributes.forEach(attr => {
    const type = getType(attr.value.type);

    let attrName = attr.name.trim();

    if (attr.name.includes('v-model')) {
      if (attr.name.startsWith('v-model:')) {
        attrName = attr.name.replace('v-model:', '').trim();
      }
      if (attr.name.includes('(v-model)')) {
        attrName = attr.name.replace('(v-model)', '').trim();
      }
      events.push({
        name: `update:${attrName}`,
        description: `update:${attrName} event`,
        functionInfo: {
          params: [
            {
              name: attrName,
              type: type,
              defaultValue: '',
              description: {
                zh_CN: '双向绑定的值',
              },
            },
          ],
          returns: {},
        },
      });
    }
  });
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
          functionInfo: event.functionInfo || {
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

function getSnippets(component, attributes) {
  const schemaMap = {
    AAffix: {
      componentName: 'AAffix',
      children: [
        {
          componentName: 'AButton',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '固钉',
              },
            },
          ],
        },
      ],
    },
    AAlert: {
      componentName: 'AAlert',
      props: {
        message: '告警提示信息',
        showIcon: true,
      },
    },
    AAnchor: {
      componentName: 'AAnchor',
      props: {
        affix: false,
        items: [
          {
            key: '1',
            href: '#components-anchor-demo-basic',
            title: 'Basic demo',
          },
          {
            key: '2',
            href: '#components-anchor-demo-static',
            title: 'Static demo',
          },
          {
            key: '3',
            href: '#api',
            title: 'API',
            children: [
              {
                key: '4',
                href: '#anchor-props',
                title: 'Anchor Props',
              },
              {
                key: '5',
                href: '#link-props',
                title: 'Link Props',
              },
            ],
          },
        ],
      },
    },
    AAutoComplete: {
      componentName: 'AAutoComplete',
      props: {
        style: 'width: 200px',
        options: [
          { value: 'Burns Bay Road' },
          { value: 'Downing Street' },
          { value: 'Wall Street' },
        ],
      },
    },
    AAvatar: {
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
    AAvatarGroup: {
      componentName: 'AAvatarGroup',
      children: [
        {
          componentName: 'AAvatar',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'A',
              },
            },
          ],
        },
        {
          componentName: 'AAvatar',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'B',
              },
            },
          ],
        },
        {
          componentName: 'AAvatar',
          children: [
            {
              componentName: 'Text',
              props: {
                text: 'C',
              },
            },
          ],
        },
      ],
    },
    ABadge: {
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
    ABadgeRibbon: {
      componentName: 'ABadgeRibbon',
      props: {
        text: 'Hippies',
      },
      children: [
        {
          componentName: 'AButton',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '徽标缎带',
              },
            },
          ],
        },
      ],
    },
    AButton: {
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
    ABreadcrumb: {
      componentName: 'ABreadcrumb',
      children: [
        {
          componentName: 'ABreadcrumbItem',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '一级',
              },
            },
          ],
        },
        {
          componentName: 'ABreadcrumbItem',
          children: [
            {
              componentName: 'Text',
              props: {
                text: '二级',
              },
            },
          ],
        },
      ],
    },
    ACard: {
      componentName: 'ACard',
      props: {
        title: 'Card Title',
      },
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
    ACarousel: {
      componentName: 'ACarousel',
      children: [
        {
          componentName: 'AImage',
          props: {
            placeholder: true,
            width: '100%',
            height: '140px',
          },
        },
        {
          componentName: 'AImage',
          props: {
            placeholder: true,
            width: '100%',
            height: '140px',
          },
        },
      ],
    },
    ACollapse: {
      componentName: 'ACollapse',
      props: {
        activeKey: '1',
      },
      children: [
        {
          componentName: 'ACollapsePanel',
          props: {
            header: 'panel header 1',
            key: '1',
          },
          children: [
            {
              componentName: 'div',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: 'panel content 1',
                  },
                },
              ],
            },
          ],
        },
        {
          componentName: 'ACollapsePanel',
          props: {
            header: 'panel header 2',
            key: '2',
          },
          children: [
            {
              componentName: 'div',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: 'panel content 2',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    AComment: {
      componentName: 'AComment',
      children: [
        {
          componentName: 'Template',
          props: {
            slot: 'content',
          },
          children: [
            {
              componentName: 'P',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: `We supply a series of design principles, practical patterns and high quality design
        resources (Sketch and Axure), to help people create their product prototypes beautifully and
        efficiently.`,
                  },
                },
              ],
            },
          ],
        },
        {
          componentName: 'Template',
          props: {
            slot: 'author',
          },
          children: [
            {
              componentName: 'A',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: `Artifyfun`,
                  },
                },
              ],
            },
          ],
        },
        {
          componentName: 'Template',
          props: {
            slot: 'avatar',
          },
          children: [
            {
              componentName: 'AAvatar',
              children: [
                {
                  componentName: 'Text',
                  props: {
                    text: 'A',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    ADropdown: {
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
    ADropdownButton: {
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
    AMenu: {
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
    ASteps: {
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
    ACascader: {
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
    ACheckbox: {
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
    AForm: {
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
    ARadio: {
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
    ASelect: {
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
    ATreeSelect: {
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
    AUpload: {
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

    ADescriptions: {
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
    AList: {
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
    AModal: {
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
    ATabs: {
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
    ATag: {
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
    ATimeline: {
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
    ATooltip: {
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
    AImage: {
      componentName: 'AImage',
      props: {
        width: '300px',
        height: '300px',
        placeholder: true,
      },
    },
  };

  const schema = schemaMap[`${componentPrefix}${component.title}`] || {};

  // attributes.forEach(attr => {
  //   const type = getType(attr.value.type)

  //   let attrName = attr.name.trim()

  //   if (attr.name.includes('v-model')) {
  //     if (attr.name.startsWith('v-model:')) {
  //       attrName = attr.name.replace('v-model:', '').trim()
  //     }
  //     if (attr.name.includes('(v-model)')) {
  //       attrName = attr.name.replace('(v-model)', '').trim()
  //     }

  //     schema.props = {
  //       ...schema.props,
  //       [attrName]: {
  //         type,
  //         value: undefined,
  //         model: { prop: attrName }
  //       }
  //     }
  //   }
  // })

  return [
    {
      name: {
        zh_CN: getSubTitle(component),
      },
      icon: component.icon || toKebabCase(component.title),
      screenshot: '',
      snippetName: `${componentPrefix}${component.title}`,
      schema,
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

const subTitleMap = {
  FormItem: {
    'zh-CN': '表单子项',
    'en-US': 'FormItem',
  },
  AnchorLink: {
    'zh-CN': '锚点链接',
    'en-US': 'AnchorLink',
  },
  AvatarGroup: {
    'zh-CN': '头像组',
    'en-US': 'AvatarGroup',
  },
  BadgeRibbon: {
    'zh-CN': '徽标缎带',
    'en-US': 'BadgeRibbon',
  },
  BreadcrumbItem: {
    'zh-CN': '面包屑子项',
    'en-US': 'BreadcrumbItem',
  },
  BreadcrumbSeparator: {
    'zh-CN': '面包屑分隔',
    'en-US': 'BreadcrumbSeparator',
  },
  CardMeta: {
    'zh-CN': '卡片内容',
    'en-US': 'CardMeta',
  },
  CollapsePanel: {
    'zh-CN': '折叠面板子项',
    'en-US': 'CollapsePanel',
  },
  DirectoryTree: {
    'zh-CN': '目录树',
    'en-US': 'DirectoryTree',
  },
  DropdownButton: {
    'zh-CN': '下拉按钮',
    'en-US': 'DropdownButton',
  },
  InputGroup: {
    'zh-CN': '输入框组',
    'en-US': 'InputGroup',
  },
  InputPassword: {
    'zh-CN': '密码输入框',
    'en-US': 'InputPassword',
  },
  InputSearch: {
    'zh-CN': '搜索框',
    'en-US': 'InputSearch',
  },
  ListItem: {
    'zh-CN': '列表子项',
    'en-US': 'ListItem',
  },
  MenuDivider: {
    'zh-CN': '菜单分隔',
    'en-US': 'MenuDivider',
  },
  MenuItem: {
    'zh-CN': '菜单子项',
    'en-US': 'MenuItem',
  },
  MenuItemGroup: {
    'zh-CN': '菜单子项组',
    'en-US': 'MenuItemGroup',
  },
  RadioButton: {
    'zh-CN': '单选按钮',
    'en-US': 'RadioButton',
  },
  RadioGroup: {
    'zh-CN': '单选组',
    'en-US': 'RadioGroup',
  },
  StatisticCountdown: {
    'zh-CN': '数字倒计时',
    'en-US': 'StatisticCountdown',
  },
  Step: {
    'zh-CN': '步骤条子项',
    'en-US': 'Step',
  },
  SubMenu: {
    'zh-CN': '子菜单',
    'en-US': 'SubMenu',
  },
  TabPane: {
    'zh-CN': '标签页子项',
    'en-US': 'TabPane',
  },
  Textarea: {
    'zh-CN': '多行输入框',
    'en-US': 'Textarea',
  },
  TimelineItem: {
    'zh-CN': '时间线子项',
    'en-US': 'TimelineItem',
  },
  Typography: {
    'zh-CN': '排版容器',
    'en-US': 'Typography',
  },
  TypographyText: {
    'zh-CN': '排版文字',
    'en-US': 'TypographyText',
  },
  TypographyTitle: {
    'zh-CN': '排版标题',
    'en-US': 'TypographyTitle',
  },
  TypographyParagraph: {
    'zh-CN': '排版段落',
    'en-US': 'TypographyParagraph',
  },
  UploadFile: {
    'zh-CN': '文件上传',
    'en-US': 'UploadFile',
  },
};
function getSubTitle(component) {
  return subTitleMap[component.title]?.['zh-CN'] || component.subtitle;
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
          zh_CN: getSubTitle(component),
        },
        component: `${componentPrefix}${component.title}`,
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
          events: getEvents(tag.events, tag.attributes),
          slots: getSlots(tag.slots),
        },
        snippets: getSnippets(component, tag.attributes),
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
    'AApp',
    'AAffix',
    'AButton',
    'ABadge',
    'ABadgeRibbon',
    'ACard',
    'ACollapsePanel',
    'AConfigProvider',
    'ADrawer',
    'ADropdown',
    'ADropdownButton',
    'ADescriptions',
    'ADescriptionsItem',
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

  // 无法透传attrs的组件，需要包裹一层div
  const wrapElementComponents = ['AImage'];
  materials.forEach(material => {
    if (wrapElementComponents.includes(material.component)) {
      material.configure.renderConfig = {
        wrapElement: 'div',
        wrapProps: {
          style: {
            display: 'inline-block',
          },
        },
      };
    }
  });

  // 需要隐藏的组件
  const hideComponents = [
    'AFormItem',
    'AApp',
    'AAnchorLink',
    'ABreadcrumbItem',
    'ABreadcrumbSeparator',
    'ACardMeta',
    'ACollapsePanel',
    'AConfigProvider',
    'ADirectoryTree',
    'ADescriptionsItem',
    'AListItem',
    'AMenuDivider',
    'AMenuItem',
    'AMenuItemGroup',
    'AStep',
    'ASubMenu',
    'ATabPane',
    'ATimelineItem',
    'ATreeNode',
  ];
  materials.forEach(material => {
    if (hideComponents.includes(material.component)) {
      material.category = undefined;
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
