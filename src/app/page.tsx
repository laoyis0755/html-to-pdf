'use client';

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createApp } from 'vue';

export default function Home() {
  const [htmlCode, setHtmlCode] = useState('<template>\n  <div style="background: #f0f0f0; padding: 20px;">\n    <h1>{{ title }}</h1>\n    <p>{{ message }}</p>\n  </div>\n</template>\n\n<script>\nexport default {\n  data() {\n    return {\n      title: "Hello Vue",\n      message: "Edit this Vue code!"\n    }\n  }\n}\n</script>');
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [vueInstance, setVueInstance] = useState<any>(null);

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setHtmlCode(value);
      updateVuePreview(value);
    }
  };

  const updateVuePreview = async (code: string) => {
    if (!previewRef.current) return;

    try {
      // 清除之前的Vue实例
      if (vueInstance) {
        vueInstance.unmount();
      }

      // 解析Vue代码
      const templateMatch = code.match(/<template>([\s\S]*)<\/template>/);
      const scriptMatch = code.match(/<script>([\s\S]*)<\/script>/);

      if (!templateMatch || !scriptMatch) {
        console.error('无效的Vue代码格式');
        return;
      }

      const template = templateMatch[1].trim();
      const script = scriptMatch[1].trim();

      // 创建临时div
      const container = document.createElement('div');
      container.innerHTML = template;
      previewRef.current.innerHTML = '';
      previewRef.current.appendChild(container);

      // 执行script部分
      const scriptContent = script.replace('export default', 'return');
      const componentOptions = new Function(scriptContent)();

      // 创建Vue实例
      const app = createApp({
        template,
        ...componentOptions
      });

      app.mount(container);
      setVueInstance(app);

    } catch (error) {
      console.error('Vue预览更新失败:', error);
    }
  };

  const generateStaticHtml = async () => {
    if (previewRef.current) {
      try {
        setLoading(true);
        
        // 创建一个新的div来处理内容
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = previewRef.current.innerHTML;
        
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
    }
  };

  const exportToPdf = async () => {
    if (previewRef.current) {
      try {
        setLoading(true);

        // 创建一个临时容器来渲染内容
        const container = document.createElement('div');
        container.style.width = '800px'; // 固定宽度以确保一致的渲染
        container.style.padding = '20px';
        container.style.background = 'white';
        container.innerHTML = htmlCode;
        document.body.appendChild(container);

        // 转换为canvas
        const canvas = await html2canvas(container, {
          scale: 2, // 更高的分辨率
          useCORS: true, // 允许加载跨域图片
          logging: false,
          backgroundColor: '#ffffff',
        });

        // 删除临时容器
        document.body.removeChild(container);

        // 计算PDF尺寸（A4）
        const imgWidth = 210; // A4 宽度（mm）
        const pageHeight = 297; // A4 高度（mm）
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        
        // 创建PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        let firstPage = true;

        // 添加页面
        while (heightLeft >= 0) {
          if (!firstPage) {
            pdf.addPage();
          }
          
          const contentWidth = canvas.width;
          const contentHeight = canvas.height;
          
          // 将canvas转换为图片
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          
          // 添加图片到PDF
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
          
          heightLeft -= pageHeight;
          position -= pageHeight;
          firstPage = false;
          
          if (heightLeft < pageHeight) {
            break;
          }
        }

        // 保存PDF
        pdf.save('exported.pdf');

      } catch (error) {
        console.error('导出PDF失败:', error);
        alert('导出PDF时发生错误，请检查HTML代码是否正确。');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // 初始化Vue预览
    updateVuePreview(htmlCode);
  }, []);

  return (
    <main className="min-h-screen p-4">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-4">Vue 转 PDF 工具</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 p-2 border-b">
              <h2 className="font-semibold">Vue 代码</h2>
            </div>
            <Editor
              height="400px"
              defaultLanguage="vue"
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
