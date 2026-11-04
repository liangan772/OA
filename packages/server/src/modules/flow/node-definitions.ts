/**
 * 六类节点的内置定义。
 * 既是 seed 的数据源，也是应用启动时自动补齐的依据（幂等）。
 */

export const RULE_OPTIONS = [
  { label: '本部门全体在编人员', value: 'DEPT_ALL' },
  { label: '本部门负责人', value: 'DEPT_LEADER' },
  { label: '本部门在编人员（不含负责人）', value: 'DEPT_MEMBERS' },
  { label: '指定编制位', value: 'POSITION' },
  { label: '指定人员', value: 'USER' },
  { label: '上级部门负责人', value: 'SUPERIOR_LEADER' },
  { label: '跨单位指定部门', value: 'CROSS_UNIT' },
];

export const NODE_DEFINITIONS = [
  {
    type: 'VOTE',
    name: '表态节点',
    description: '按编制规则自动生成表态人员；部门正职负责人持一票否决权',
    defaultConfig: {
      assigneeRule: 'DEPT_ALL',
      allowVeto: true,
      allowAbstain: true,
      allowOpinion: true,
      deadlineHours: 72,
      timeoutAction: 'ABSTAIN',
    },
    configSchema: {
      fields: [
        { key: 'assigneeRule', label: '表态人员来源', type: 'select', options: RULE_OPTIONS, group: '人员' },
        { key: 'positionIds', label: '指定编制位', type: 'positionPicker', group: '人员', visibleWhen: { assigneeRule: 'POSITION' } },
        { key: 'userIds', label: '指定人员', type: 'userPicker', group: '人员', visibleWhen: { assigneeRule: 'USER' } },
        { key: 'orgIds', label: '跨单位部门', type: 'orgPicker', group: '人员', visibleWhen: { assigneeRule: 'CROSS_UNIT' } },
        { key: 'allowVeto', label: '启用负责人一票否决', type: 'boolean', group: '规则' },
        { key: 'allowAbstain', label: '允许弃权', type: 'boolean', group: '规则' },
        { key: 'allowOpinion', label: '允许填写意见', type: 'boolean', group: '规则' },
        { key: 'deadlineHours', label: '表态时限（小时）', type: 'number', group: '时限' },
        { key: 'timeoutAction', label: '超时视为', type: 'select', options: [{ label: '弃权', value: 'ABSTAIN' }, { label: '同意', value: 'AGREE' }], group: '时限' },
      ],
    },
  },
  {
    type: 'SUMMARIZE',
    name: '总结节点',
    description: '汇总表态结果并给出结论码，可按结论分流到不同后继节点',
    defaultConfig: {
      summarizerRule: 'DEPT_LEADER',
      decisionRule: 'MAJORITY',
      passThreshold: 0.5,
    },
    configSchema: {
      fields: [
        { key: 'summarizerRule', label: '总结人', type: 'select', options: RULE_OPTIONS, group: '人员' },
        { key: 'summarizerUserIds', label: '指定总结人', type: 'userPicker', group: '人员', visibleWhen: { summarizerRule: 'USER' } },
        {
          key: 'decisionRule',
          label: '结论规则',
          type: 'select',
          group: '规则',
          options: [
            { label: '全票通过', value: 'ALL_AGREE' },
            { label: '多数通过', value: 'MAJORITY' },
            { label: '负责人裁定', value: 'LEADER_DECIDE' },
            { label: '人工填写', value: 'MANUAL' },
          ],
        },
        { key: 'passThreshold', label: '通过比例阈值', type: 'number', group: '规则', visibleWhen: { decisionRule: 'MAJORITY' } },
        { key: 'branches', label: '结论分流', type: 'branches', group: '分流' },
      ],
    },
  },
  {
    type: 'REPORT',
    name: '上报节点',
    description: '向指定上级部门上报，自动创建上级审批实例并挂起等待回传',
    defaultConfig: {
      targetRule: 'PARENT_DEPT',
      approveDefinitionCode: 'APPROVE-01',
      carryForm: true,
    },
    configSchema: {
      fields: [
        {
          key: 'targetRule',
          label: '上报目标',
          type: 'select',
          group: '目标',
          options: [
            { label: '直接上级部门', value: 'PARENT_DEPT' },
            { label: '上级单位同名部门', value: 'SAME_NAME_DEPT' },
            { label: '上级单位办公室', value: 'PARENT_UNIT_OFFICE' },
            { label: '指定部门', value: 'SPECIFIC_ORG' },
          ],
        },
        { key: 'targetOrgId', label: '指定部门', type: 'orgPicker', group: '目标', visibleWhen: { targetRule: 'SPECIFIC_ORG' } },
        { key: 'approveDefinitionCode', label: '接报审批流程编码', type: 'text', group: '目标' },
        { key: 'carryForm', label: '随流程携带表单内容', type: 'boolean', group: '内容' },
      ],
    },
  },
  {
    type: 'RETURN',
    name: '返回节点',
    description: '把流程退回下级的上报节点，下级修改后可重新上报',
    defaultConfig: { targetRule: 'ORIGIN_REPORT', maxRound: 3 },
    configSchema: {
      fields: [
        {
          key: 'targetRule',
          label: '返回目标',
          type: 'select',
          group: '目标',
          options: [
            { label: '原始上报节点', value: 'ORIGIN_REPORT' },
            { label: '指定下级部门', value: 'SPECIFIC_ORG' },
          ],
        },
        { key: 'targetOrgId', label: '指定部门', type: 'orgPicker', group: '目标', visibleWhen: { targetRule: 'SPECIFIC_ORG' } },
        { key: 'maxRound', label: '最大重报轮次', type: 'number', group: '规则' },
      ],
    },
  },
  {
    type: 'ASSIGN',
    name: '分配节点',
    description: '把流程分配给一个部门或个人；部门级分配由负责人接单后可再转派',
    defaultConfig: { targetType: 'ORG', allowTransfer: true, deadlineHours: 48 },
    configSchema: {
      fields: [
        {
          key: 'targetType',
          label: '分配对象',
          type: 'select',
          group: '目标',
          options: [
            { label: '部门', value: 'ORG' },
            { label: '个人', value: 'USER' },
            { label: '编制位', value: 'POSITION' },
          ],
        },
        { key: 'targetOrgId', label: '目标部门', type: 'orgPicker', group: '目标', visibleWhen: { targetType: 'ORG' } },
        { key: 'targetUserId', label: '目标人员', type: 'userPicker', group: '目标', visibleWhen: { targetType: 'USER' } },
        { key: 'targetPositionId', label: '目标编制位', type: 'positionPicker', group: '目标', visibleWhen: { targetType: 'POSITION' } },
        { key: 'allowTransfer', label: '允许接单人转派', type: 'boolean', group: '规则' },
        { key: 'deadlineHours', label: '办理时限（小时）', type: 'number', group: '时限' },
      ],
    },
  },
  {
    type: 'EXECUTE',
    name: '执行节点',
    description: '执行人需确认并填写执行说明意见，可上传佐证材料',
    defaultConfig: {
      assigneeRule: 'DEPT_LEADER',
      requireConfirm: true,
      requireOpinion: true,
      allowAttachment: true,
      deadlineHours: 72,
    },
    configSchema: {
      fields: [
        { key: 'assigneeRule', label: '执行人', type: 'select', options: RULE_OPTIONS, group: '人员' },
        { key: 'userIds', label: '指定人员', type: 'userPicker', group: '人员', visibleWhen: { assigneeRule: 'USER' } },
        { key: 'requireConfirm', label: '必须确认', type: 'boolean', group: '规则' },
        { key: 'requireOpinion', label: '必须填写执行说明', type: 'boolean', group: '规则' },
        { key: 'allowAttachment', label: '允许上传附件', type: 'boolean', group: '规则' },
        { key: 'deadlineHours', label: '办理时限（小时）', type: 'number', group: '时限' },
      ],
    },
  },
];
