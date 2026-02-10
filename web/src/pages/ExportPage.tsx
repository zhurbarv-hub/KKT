import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deadlinesApi, deadlineTypesApi } from '../services/api';
import type { StatusColor, Deadline, DeadlineType } from '../types';
import { Download, FileSpreadsheet, Filter, Calendar, Check } from 'lucide-react';
import clsx from 'clsx';
import { format, subDays, addDays } from 'date-fns';

type ExportFormat = 'csv' | 'excel';

export default function ExportPage() {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [statusFilter, setStatusFilter] = useState<StatusColor | ''>('');
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const { data: deadlineTypes = [] } = useQuery({
    queryKey: ['deadline-types'],
    queryFn: deadlineTypesApi.list,
  });

  const { data: deadlines = [] } = useQuery({
    queryKey: ['deadlines-export'],
    queryFn: () => deadlinesApi.list(),
  });

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((d: Deadline) => {
      if (statusFilter && d.status_color !== statusFilter) return false;
      if (typeFilter && d.deadline_type_id !== typeFilter) return false;
      const date = new Date(d.expiration_date);
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return date >= from && date <= to;
    });
  }, [deadlines, statusFilter, typeFilter, dateFrom, dateTo]);

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);

    try {
      const headers = ['Клиент', 'Компания', 'Тип услуги', 'Дата истечения', 'Осталось дней', 'Статус'];
      const rows = filteredDeadlines.map((d: Deadline) => [
        d.user_name || '',
        d.company_name || '',
        d.deadline_type_name || '',
        format(new Date(d.expiration_date), 'dd.MM.yyyy'),
        d.days_until_expiration?.toString() || '',
        d.status_color === 'green' ? 'Норма' :
        d.status_color === 'yellow' ? 'Внимание' :
        d.status_color === 'red' ? 'Срочно' :
        d.status_color === 'expired' ? 'Просрочено' : 'Неизвестно'
      ]);

      let content: string;
      let mimeType: string;
      let filename: string;

      if (exportFormat === 'csv') {
        const csvContent = [headers, ...rows]
          .map((row: string[]) => row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(';'))
          .join('\n');
        content = '\ufeff' + csvContent;
        mimeType = 'text/csv;charset=utf-8';
        filename = `deadlines_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else {
        const xmlRows = rows.map((row: string[]) => 
          '<Row>' + row.map((cell: string) => `<Cell><Data ss:Type="String">${cell}</Data></Cell>`).join('') + '</Row>'
        ).join('');
        const headerRow = '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('') + '</Row>';
        
        content = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Дедлайны">
<Table>
${headerRow}
${xmlRows}
</Table>
</Worksheet>
</Workbook>`;
        mimeType = 'application/vnd.ms-excel';
        filename = `deadlines_${format(new Date(), 'yyyy-MM-dd')}.xls`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Экспорт данных</h1>
        <p className="text-gray-600 mt-1">Выгрузка дедлайнов в файл</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Filter size={20} />Фильтры</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusColor | '')}>
                <option value="">Все статусы</option>
                <option value="green">Норма</option>
                <option value="yellow">Внимание</option>
                <option value="red">Срочно</option>
                <option value="expired">Просрочено</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип услуги</label>
              <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Все типы</option>
                {deadlineTypes.map((type: DeadlineType) => (<option key={type.id} value={type.id}>{type.type_name}</option>))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar size={14} className="inline mr-1" />Дата от</label>
                <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar size={14} className="inline mr-1" />Дата до</label>
                <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileSpreadsheet size={20} />Формат экспорта</h2>

          <div className="space-y-3 mb-6">
            <label className={clsx('flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors', exportFormat === 'csv' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300')}>
              <input type="radio" name="format" value="csv" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} className="w-4 h-4 text-violet-600" />
              <div><p className="font-medium text-gray-900">CSV</p><p className="text-sm text-gray-500">Универсальный формат для таблиц</p></div>
            </label>

            <label className={clsx('flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors', exportFormat === 'excel' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300')}>
              <input type="radio" name="format" value="excel" checked={exportFormat === 'excel'} onChange={() => setExportFormat('excel')} className="w-4 h-4 text-violet-600" />
              <div><p className="font-medium text-gray-900">Excel (XLS)</p><p className="text-sm text-gray-500">Microsoft Excel формат</p></div>
            </label>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg mb-4"><p className="text-sm text-gray-600">Найдено записей: <strong>{filteredDeadlines.length}</strong></p></div>

          {exportSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 flex items-center gap-2"><Check size={18} className="text-green-600" /><span className="text-green-700">Файл успешно скачан!</span></div>
          )}

          <button onClick={handleExport} disabled={exporting || filteredDeadlines.length === 0} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {exporting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Экспорт...</>) : (<><Download size={18} />Скачать {exportFormat.toUpperCase()}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
