'use client';

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Home() {
  const [htmlCode, setHtmlCode] = useState('<div style="background: #f0f0f0; padding: 20px;">\n  <h1>Hello World</h1>\n  <p>Edit this HTML code!</p>\n  <div class="export-this">\n    <h2>这个 div 将被导出</h2>\n    <p>因为它有 export-this 类名</p>\n  </div>\n  <div class="dont-export">\n    <p>这个 div 不会被导出</p>\n  </div>\n</div>');
  const [targetClass, setTargetClass] = useState('');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewOnly, setPreviewOnly] = useState<string | null>(null);

  // 提取HTML中的所有类名
  const extractClassNames = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const classes = new Set<string>();
    const elements = tempDiv.getElementsByClassName('*');
    
    // 使用正则表达式从HTML字符串中提取类名
    const classMatches = html.match(/class=["']([^"']+)["']/g);
    if (classMatches) {
      classMatches.forEach(match => {
        const classNames = match.match(/class=["']([^"']+)["']/)?.[1];
        if (classNames) {
          classNames.split(' ').forEach(className => {
            if (className.trim()) {
              classes.add(className.trim());
            }
          });
        }
      });
    }
    
    return Array.from(classes).sort();
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setHtmlCode(value);
      updatePreview(value);
      // 提取并更新可用的类名
      const classes = extractClassNames(value);
      setAvailableClasses(classes);
      // 如果当前选择的类名不在新的类名列表中，清空选择
      if (!classes.includes(targetClass)) {
        setTargetClass('');
        setPreviewOnly(null);
      }
    }
  };

  const updatePreview = (code: string, previewClass?: string | null) => {
    if (!previewRef.current) return;
    
    if (!previewClass) {
      // 显示完整预览
      previewRef.current.innerHTML = code;
      return;
    }

    // 创建临时容器来解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = code;
    
    // 提取指定类名的元素
    const elements = tempDiv.getElementsByClassName(previewClass);
    if (elements.length === 0) {
      previewRef.current.innerHTML = '<div class="text-gray-500">没有找到指定类名的元素</div>';
      return;
    }
    
    // 创建预览容器
    const previewContainer = document.createElement('div');
    Array.from(elements).forEach(element => {
      previewContainer.appendChild(element.cloneNode(true));
    });
    
    previewRef.current.innerHTML = previewContainer.innerHTML;
  };

  // 处理类名选择变化
  const handleClassSelect = (className: string) => {
    setTargetClass(className);
    // 更新预览，但不改变HTML代码
    if (className) {
      setPreviewOnly(className);
      updatePreview(htmlCode, className);
    } else {
      setPreviewOnly(null);
      updatePreview(htmlCode);
    }
  };

  const extractElements = (container: HTMLElement, className: string) => {
    if (!className.trim()) {
      return container.innerHTML;
    }

    const elements = container.getElementsByClassName(className);
    if (elements.length === 0) {
      console.warn(`没有找到类名为 "${className}" 的元素，将导出所有内容`);
      return container.innerHTML;
    }
    
    // 创建包装容器来保持布局结构
    const wrapperDiv = document.createElement('div');
    wrapperDiv.style.cssText = `
      width: 100%;
      background: #ffffff;
      padding: 20px;
      box-sizing: border-box;
    `;

    // 处理计算样式的函数
    const computeStyles = (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element);
      const properties = [
        'color', 'background', 'background-color', 'padding', 'margin',
        'border', 'width', 'height', 'font-size', 'font-family',
        'font-weight', 'text-align', 'display', 'flex-direction',
        'justify-content', 'align-items', 'gap', 'position',
        'box-shadow', 'border-radius', 'line-height', 'letter-spacing'
      ];

      let styles = '';
      properties.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== '') {
          styles += `${prop}: ${value}; `;
        }
      });
      return styles;
    };

    // 递归处理元素的所有子元素
    const processElement = (element: Element) => {
      if (element instanceof HTMLElement) {
        const styles = computeStyles(element);
        element.style.cssText += styles;
      }
      Array.from(element.children).forEach(processElement);
    };

    Array.from(elements).forEach(element => {
      const clone = element.cloneNode(true) as HTMLElement;
      processElement(clone);
      wrapperDiv.appendChild(clone);
    });

    return wrapperDiv.outerHTML;
  };

  const generateStaticHtml = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);
      
      // 提取指定类名的元素
      const extractedHtml = extractElements(previewRef.current, targetClass);
      
      // 格式化HTML
      const beautifyHtml = (html: string) => {
        return html
          .replace(/></g, '>\n<')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map(line => '  ' + line)
          .join('\n');
      };

      setHtmlCode(beautifyHtml(extractedHtml));
    } catch (error) {
      console.error('生成静态HTML失败:', error);
      alert('生成静态HTML时发生错误。');
    } finally {
      setLoading(false);
    }
  };

  const exportToPdf = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);

      // 创建临时容器
      const container = document.createElement('div');
      container.style.cssText = `
        width: 800px;
        padding: 20px;
        background: white;
        margin: 0 auto;
      `;
      
      // 提取指定类名的元素
      const extractedHtml = extractElements(previewRef.current, targetClass);
      container.innerHTML = extractedHtml;
      
      // 添加到body并等待样式应用
      document.body.appendChild(container);
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        // 转换为canvas
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: true,
          backgroundColor: '#ffffff'
        });

        // 计算PDF尺寸（A4）
        const imgWidth = 210; // A4 宽度（mm）
        const pageHeight = 297; // A4 高度（mm）
        const imgHeight = canvas.height * imgWidth / canvas.width;
        
        // 创建PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, imgWidth, imgHeight);
        pdf.save('exported.pdf');
      } finally {
        // 确保临时容器被删除
        document.body.removeChild(container);
      }
    } catch (error: any) {
      console.error('导出PDF失败:', error);
      alert('导出PDF时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 初始化预览
  useEffect(() => {
    updatePreview(htmlCode);
    const classes = extractClassNames(htmlCode);
    setAvailableClasses(classes);
  }, []);

  return (
    <main className="min-h-screen p-4">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-4">HTML 转 PDF 工具</h1>
        <div className="mb-4">
          <label htmlFor="targetClass" className="block text-sm font-medium text-gray-700 mb-1">
            要导出的元素类名
          </label>
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                id="targetClass"
                value={targetClass}
                onChange={(e) => handleClassSelect(e.target.value)}
                className="w-1/2 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入要导出的元素的类名"
                list="class-suggestions"
              />
              <select
                value={targetClass}
                onChange={(e) => handleClassSelect(e.target.value)}
                className="w-1/2 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- 选择类名 --</option>
                {availableClasses.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 flex items-center whitespace-nowrap">
              留空则导出所有内容
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 p-2 border-b">
              <h2 className="font-semibold">HTML 代码</h2>
            </div>
            <Editor
              height="400px"
              defaultLanguage="html"
              value={htmlCode}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </div>
          <div>
            <div className="border rounded-lg">
              <div className="bg-gray-100 p-2 border-b flex justify-between items-center">
                <h2 className="font-semibold">预览</h2>
                {previewOnly && (
                  <button
                    onClick={() => {
                      setPreviewOnly(null);
                      setTargetClass('');
                      updatePreview(htmlCode);
                    }}
                    className="text-sm text-blue-500 hover:text-blue-700"
                  >
                    显示完整预览
                  </button>
                )}
              </div>
              <div className="p-4">
                <div
                  ref={previewRef}
                  className="border p-4 rounded min-h-[400px]"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <button
                onClick={generateStaticHtml}
                disabled={loading}
                className={`w-full ${loading ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'} text-white font-semibold py-2 px-4 rounded transition-colors`}
              >
                {loading ? '处理中...' : '生成静态HTML'}
              </button>
              <button
                onClick={exportToPdf}
                disabled={loading}
                className={`w-full ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white font-semibold py-2 px-4 rounded transition-colors`}
              >
                {loading ? '导出中...' : '导出为 PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
