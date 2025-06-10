'use client';

import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Home() {
  const [htmlCode, setHtmlCode] = useState('<div style="background: #f0f0f0; padding: 20px;">\n  <h1>Hello World</h1>\n  <p>Edit this HTML code!</p>\n  <div class="export-this">\n    <h2>这个 div 将被导出</h2>\n    <p>因为它有 export-this 类名</p>\n  </div>\n  <div class="dont-export">\n    <p>这个 div 不会被导出</p>\n  </div>\n</div>');
  const [targetClass, setTargetClass] = useState('export-this');
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setHtmlCode(value);
      updatePreview(value);
    }
  };

  const updatePreview = (code: string) => {
    if (!previewRef.current) return;
    previewRef.current.innerHTML = code;
  };

  const extractElements = (container: HTMLElement, className: string) => {
    const elements = container.getElementsByClassName(className);
    if (elements.length === 0) {
      // 如果没有找到指定类名的元素，返回整个容器的内容
      return container.innerHTML;
    }
    
    // 创建一个临时容器来存放提取的元素
    const tempContainer = document.createElement('div');
    Array.from(elements).forEach(element => {
      // 克隆节点以保留所有属性和样式
      const clone = element.cloneNode(true) as HTMLElement;
      // 获取计算后的样式
      const computedStyle = window.getComputedStyle(element as HTMLElement);
      // 将计算后的样式应用到克隆节点
      Object.values(computedStyle).forEach(property => {
        if (property !== '') {
          clone.style[property as any] = computedStyle.getPropertyValue(property);
        }
      });
      tempContainer.appendChild(clone);
    });
    return tempContainer.innerHTML;
  };

  const generateStaticHtml = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);
      
      // 创建一个新的div来处理内容
      const tempDiv = document.createElement('div');
      // 提取指定类名的元素
      const extractedHtml = extractElements(previewRef.current, targetClass);
      tempDiv.innerHTML = extractedHtml;
      
      // 内联所有可计算的样式
      const processElement = (element: Element) => {
        if (element instanceof HTMLElement) {
          const computedStyle = window.getComputedStyle(element);
          let styles = element.getAttribute('style') || '';
          
          // 添加计算后的样式
          const importantProperties = [
            'color', 'background-color', 'padding', 'margin',
            'border', 'width', 'height', 'font-size',
            'font-family', 'font-weight', 'text-align',
            'display', 'flex-direction', 'justify-content',
            'align-items', 'gap', 'position'
          ];

          importantProperties.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value) {
              styles += `${prop}: ${value}; `;
            }
          });

          if (styles) {
            element.setAttribute('style', styles);
          }
        }

        // 递归处理子元素
        Array.from(element.children).forEach(processElement);
      };

      // 处理所有元素
      processElement(tempDiv);

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

      const staticHtml = `<div style="width: 100%; height: 100%; background: #ffffff;">
${beautifyHtml(tempDiv.innerHTML)}
</div>`;

      setHtmlCode(staticHtml);
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

      // 创建一个临时容器
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.padding = '20px';
      container.style.background = 'white';
      
      // 提取指定类名的元素
      const extractedHtml = extractElements(previewRef.current, targetClass);
      container.innerHTML = extractedHtml;
      
      document.body.appendChild(container);

      // 转换为canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // 删除临时容器
      document.body.removeChild(container);

      // 计算PDF尺寸（A4）
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let firstPage = true;

      while (heightLeft >= 0) {
        if (!firstPage) {
          pdf.addPage();
        }
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
        
        heightLeft -= pageHeight;
        position -= pageHeight;
        firstPage = false;
        
        if (heightLeft < pageHeight) {
          break;
        }
      }

      pdf.save('exported.pdf');
    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出PDF时发生错误，请检查HTML代码是否正确。');
    } finally {
      setLoading(false);
    }
  };

  // 初始化预览
  useState(() => {
    updatePreview(htmlCode);
  });

  return (
    <main className="min-h-screen p-4">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-4">HTML 转 PDF 工具</h1>
        <div className="mb-4">
          <label htmlFor="targetClass" className="block text-sm font-medium text-gray-700 mb-1">
            要导出的元素类名
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="targetClass"
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入要导出的元素的类名"
            />
            <div className="text-sm text-gray-500 flex items-center">
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
              defaultValue={htmlCode}
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
              <div className="bg-gray-100 p-2 border-b">
                <h2 className="font-semibold">预览</h2>
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
