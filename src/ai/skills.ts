import { z } from 'zod';
import { schemas } from './tools';
import type { Skill } from '../types';
export const skillSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(80),
    description: z.string().max(500),
    prompt: z.string().min(1).max(12000),
    enabled: z.boolean().default(true),
    tools: z
      .array(z.string().refine((name) => name in schemas, '此项操作不受支持'))
      .min(1)
      .max(30),
    triggers: z.array(z.string().min(1).max(80)).max(20),
    slashCommand: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
    context: z.enum(['selection', 'sheet']).default('selection'),
  })
  .strict();
export const builtinSkills: Skill[] = [
  {
    id: 'cleaning',
    name: '数据清理',
    description: '去除多余空格、统一数值，保留公式与原有结构。',
    prompt:
      '清洗指定选区：去除首尾空格、连续空格与全角空格，将明确的千分位数字文本转换为数值。保留前导零编号和公式。不要删除数据。',
    enabled: true,
    tools: ['read_range', 'clean_data', 'set_format'],
    triggers: ['清洗', '清理', 'clean'],
    slashCommand: 'clean',
    context: 'selection',
  },
  {
    id: 'formula',
    name: '公式助手',
    description: '说明选区中的公式如何计算，并帮助排查问题。',
    prompt: '解释当前选区公式，引用实际单元格及依赖数据。不能编造计算结果；缺少数据时先读取。',
    enabled: true,
    tools: ['read_range', 'set_formula', 'write_range'],
    triggers: ['公式', '怎么算', 'formula'],
    slashCommand: 'formula',
    context: 'selection',
  },
  {
    id: 'summary',
    name: '数据汇总',
    description: '按部门或类别汇总数据，生成独立结果工作表。',
    prompt:
      '先识别表头和数据范围，排除已有合计行。按用户指定的分组列和数值列汇总，在新工作表放置结果。不要修改原始数据。',
    enabled: true,
    tools: ['read_range', 'summarize', 'create_sheet', 'write_range', 'set_format', 'set_formula'],
    triggers: ['汇总', '按部门', '按照部门', 'summary'],
    slashCommand: 'summary',
    context: 'sheet',
  },
];
export function parseSkill(text: string): Skill {
  return skillSchema.parse(JSON.parse(text));
}
export function loadSkills(): Skill[] {
  try {
    const raw = localStorage.getItem('tnt-skills');
    return raw ? z.array(skillSchema).max(100).parse(JSON.parse(raw)) : structuredClone(builtinSkills);
  } catch {
    return structuredClone(builtinSkills);
  }
}
export function saveSkills(skills: Skill[]) {
  localStorage.setItem('tnt-skills', JSON.stringify(skills));
}
export function matchSkill(text: string, skills: Skill[]) {
  const command = /^\/([a-z][a-z0-9-]*)\b/.exec(text.trimStart())?.[1];
  if (command) {
    const skill = skills.find((s) => s.slashCommand === command);
    if (!skill || !skill.enabled) throw new Error('此技能未安装或已停用。');
    return skill;
  }
  return skills.find(
    (s) => s.enabled && s.triggers.some((t) => text.toLowerCase().includes(t.toLowerCase())),
  );
}
