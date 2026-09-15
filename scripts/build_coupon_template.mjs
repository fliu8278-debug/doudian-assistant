import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'E:/zizhu/outputs/01a00e58-e186-7272-a899-4feff626e752';
const outputPath = `${outputDir}/涨粉券填写模板.xlsx`;

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('涨粉券填写模板');
const guide = workbook.worksheets.add('固定规则');
const options = workbook.worksheets.add('选项');

sheet.showGridLines = false;
guide.showGridLines = false;
options.showGridLines = false;

sheet.getRange('A1:H1').values = [[
  '是否启用',
  '款号',
  '优惠券名称',
  '满减门槛',
  '减免金额',
  '商品搜索关键词',
  '备注',
  '校验结果',
]];

sheet.getRange('A2:H2').values = [[
  '是',
  '216704',
  '216704',
  899,
  100,
  '216704',
  '示例行，正式使用时可以删除或改成你的数据',
  '',
]];

for (let row = 2; row <= 102; row += 1) {
  if (row > 2) {
    sheet.getRange(`A${row}`).values = [['是']];
    sheet.getRange(`C${row}`).formulas = [[`=IF(B${row}="","",B${row})`]];
    sheet.getRange(`F${row}`).formulas = [[`=IF(B${row}="","",B${row})`]];
  }

  sheet.getRange(`H${row}`).formulas = [[
    `=IF(A${row}<>"是","跳过",IF(B${row}="","缺款号",IF(D${row}="","缺满减门槛",IF(E${row}="","缺减免金额","通过"))))`,
  ]];
}

guide.getRange('A1:C1').values = [['项目', '固定值', '说明']];
guide.getRange('A2:C10').values = [
  ['涨粉账户', '店铺官方账号', '建券时固定选择，不需要在模板里填写。'],
  ['执行店铺', '前端批次设置', '在软件“建立优惠券”页面选择，整批优惠券使用同一个店铺。'],
  ['领取时间', '前端批次设置', '在软件“建立优惠券”页面填写，整批优惠券共用同一组时间。'],
  ['使用时间', '限制有效天数：1天', '建券时固定选择。'],
  ['自动续期', '不开启', '建券时固定选择。'],
  ['优惠方式', '满减', '模板只填写满减门槛和减免金额。'],
  ['券发放量', '不限', '建券时固定选择。'],
  ['每人限领', '不限', '建券时固定选择。'],
  ['商品范围', '指定商品', '建券时固定选择，并用商品搜索关键词添加商品。'],
];

guide.getRange('A12:C12').values = [['可填写字段', '是否必填', '怎么填']];
guide.getRange('A13:C20').values = [
  ['是否启用', '必填', '是/否，只有“是”的行会执行。'],
  ['款号', '必填', '例如 246240，这是优惠券名称的默认值。'],
  ['优惠券名称', '可空', '不填则默认等于款号。'],
  ['满减门槛', '必填', '例如 899。'],
  ['减免金额', '必填', '例如 100。'],
  ['商品搜索关键词', '可空', '不填则默认等于款号；需要更精确搜索时可手填完整商品编码。'],
  ['备注', '可空', '只给自己看，不参与建券。'],
];

options.getRange('A1:A3').values = [['是否启用'], ['是'], ['否']];

sheet.getRange('A1:H1').format = {
  fill: '#E8F0FF',
  font: { bold: true, color: '#17263A' },
};
guide.getRange('A1:C1').format = {
  fill: '#E8F0FF',
  font: { bold: true, color: '#17263A' },
};
guide.getRange('A12:C12').format = {
  fill: '#E8F0FF',
  font: { bold: true, color: '#17263A' },
};

sheet.getRange('A1:H102').format.borders = {
  preset: 'inside',
  style: 'thin',
  color: '#E3E9F0',
};
guide.getRange('A1:C20').format.borders = {
  preset: 'inside',
  style: 'thin',
  color: '#E3E9F0',
};

sheet.getRange('A:A').format.columnWidth = 10;
sheet.getRange('B:C').format.columnWidth = 18;
sheet.getRange('D:E').format.columnWidth = 12;
sheet.getRange('F:G').format.columnWidth = 24;
sheet.getRange('H:H').format.columnWidth = 14;
guide.getRange('A:A').format.columnWidth = 18;
guide.getRange('B:B').format.columnWidth = 22;
guide.getRange('C:C').format.columnWidth = 54;

sheet.getRange('B:C').format.numberFormat = '@';
sheet.getRange('D:E').format.numberFormat = '0';
sheet.getRange('F:F').format.numberFormat = '@';
sheet.getRange('A2:A102').dataValidation = { rule: { type: 'list', formula1: "'选项'!$A$2:$A$3" } };
sheet.freezePanes.freezeRows(1);
guide.freezePanes.freezeRows(1);

const check = await workbook.inspect({
  kind: 'table',
  sheetId: '涨粉券填写模板',
  range: 'A1:H4',
  include: 'values,formulas',
  tableMaxRows: 4,
  tableMaxCols: 8,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
  summary: 'formula error scan',
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: '涨粉券填写模板',
  range: 'A1:H12',
  scale: 1,
  format: 'png',
});
await fs.writeFile(`${outputDir}/涨粉券填写模板预览.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
