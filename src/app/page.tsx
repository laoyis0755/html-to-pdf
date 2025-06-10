'use client';

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Home() {
  const [htmlCode, setHtmlCode] = useState('<div style="background: #f0f0f0; padding: 20px;">\n  <h1 style="color: #333; margin-bottom: 10px;">Hello World</h1>\n  <p style="color: #666;">Edit this HTML code!</p>\n  <div class="export-this" style="background: #fff; padding: 15px; border-radius: 8px; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">\n    <h2 style="color: #2c5282;">这个 div 将被导出</h2>\n    <p style="color: #4a5568;">因为它有 export-this 类名</p>\n  </div>\n  <div class="dont-export" style="background: #e2e8f0; padding: 15px; margin-top: 20px;">\n    <p style="color: #718096;">这个 div 不会被导出</p>\n  </div>\n</div>');
  const [targetClass, setTargetClass] = useState('');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewOnly, setPreviewOnly] = useState<string | null>(null);

  // 提取HTML中的所有类名
  const extractClassNames = (html: string) => {
    const classRegex = /class=["']([^"']+)["']/g;
    const classes = new Set<string>();
    let match;
    
    while ((match = classRegex.exec(html)) !== null) {
      match[1].split(/\s+/).forEach(className => {
        if (className) classes.add(className);
      });
    }
    
    return Array.from(classes).sort();
  };

  // 深度复制元素的计算样式
  const copyComputedStyles = (source: HTMLElement, target: HTMLElement) => {
    const computedStyle = window.getComputedStyle(source);
    
    // 复制所有计算样式
    Array.from(computedStyle).forEach(key => {
      target.style.setProperty(key, computedStyle.getPropertyValue(key), computedStyle.getPropertyPriority(key));
    });

    // 特别处理一些重要的样式属性
    ['margin', 'padding', 'border', 'background', 'color', 'font-family', 'font-size', 'line-height'].forEach(prop => {
      target.style.setProperty(prop, computedStyle.getPropertyValue(prop), computedStyle.getPropertyPriority(prop));
    });

    // 处理伪元素
    ['::before', '::after'].forEach(pseudo => {
      const pseudoStyle = window.getComputedStyle(source, pseudo);
      if (pseudoStyle.content !== 'none' && pseudoStyle.content !== '') {
        const pseudoElement = document.createElement('span');
        pseudoElement.setAttribute('data-pseudo', pseudo);
        Array.from(pseudoStyle).forEach(key => {
          pseudoElement.style.setProperty(key, pseudoStyle.getPropertyValue(key));
        });
        target.appendChild(pseudoElement);
      }
    });
  };

  // 递归处理元素及其子元素
  const processElement = (sourceElement: HTMLElement, targetElement: HTMLElement) => {
    copyComputedStyles(sourceElement, targetElement);
    
    // 处理子元素
    Array.from(sourceElement.children).forEach((child, index) => {
      if (child instanceof HTMLElement && targetElement.children[index] instanceof HTMLElement) {
        processElement(child, targetElement.children[index] as HTMLElement);
      }
    });
  };

  const updatePreview = (code: string, previewClass?: string | null) => {
    if (!previewRef.current) return;

    try {
      // 创建一个隐藏的沙盒容器
      const sandbox = document.createElement('div');
      sandbox.style.position = 'absolute';
      sandbox.style.left = '-9999px';
      sandbox.style.width = previewRef.current.clientWidth + 'px';
      sandbox.innerHTML = code;
      document.body.appendChild(sandbox);

      // 等待样式计算
      requestAnimationFrame(() => {
        try {
          if (!previewClass) {
            // 直接克隆整个代码内容，不需要特殊处理
            previewRef.current!.innerHTML = code;
            
            // 处理完整预览中的所有元素样式
            const elements = previewRef.current!.getElementsByTagName('*');
            Array.from(elements).forEach(el => {
              if (el instanceof HTMLElement) {
                // 应用计算后的样式
                const computed = window.getComputedStyle(el);
                // 特别关注的样式属性
                ['margin', 'padding', 'border', 'background', 'color', 
                 'font-family', 'font-size', 'line-height', 'box-shadow', 
                 'border-radius'].forEach(prop => {
                  el.style.setProperty(prop, computed.getPropertyValue(prop), 
                    computed.getPropertyPriority(prop));
                });
              }
            });
          } else {
            const targetElements = sandbox.getElementsByClassName(previewClass);
            if (targetElements.length === 0) {
              previewRef.current!.innerHTML = '<div class="text-gray-500">没有找到指定类名的元素</div>';
              return;
            }

            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            // 获取每个目标元素的完整上下文
            Array.from(targetElements).forEach(element => {
              if (element instanceof HTMLElement) {
                // 创建一个包装容器来保持布局上下文
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.width = '100%';
                
                // 计算元素的原始尺寸和位置
                const originalRect = element.getBoundingClientRect();
                const clonedElement = element.cloneNode(true) as HTMLElement;
                
                // 重置可能影响布局的样式
                clonedElement.style.position = 'relative';
                clonedElement.style.top = 'auto';
                clonedElement.style.left = 'auto';
                clonedElement.style.margin = '0';
                clonedElement.style.width = originalRect.width + 'px';
                
                // 复制计算样式
                processElement(element, clonedElement);
                
                // 处理子元素的定位
                const processChildrenPositioning = (parent: HTMLElement, clone: HTMLElement) => {
                  Array.from(parent.children).forEach((child, index) => {
                    if (child instanceof HTMLElement && clone.children[index] instanceof HTMLElement) {
                      const childClone = clone.children[index] as HTMLElement;
                      const childRect = child.getBoundingClientRect();
                      const parentRect = parent.getBoundingClientRect();
                      
                      // 保持子元素的相对位置
                      const relativeTop = childRect.top - parentRect.top;
                      const relativeLeft = childRect.left - parentRect.left;
                      
                      childClone.style.position = 'absolute';
                      childClone.style.top = relativeTop + 'px';
                      childClone.style.left = relativeLeft + 'px';
                      childClone.style.width = childRect.width + 'px';
                      childClone.style.height = childRect.height + 'px';
                      
                      processChildrenPositioning(child, childClone);
                    }
                  });
                };
                
                wrapper.appendChild(clonedElement);
                processChildrenPositioning(element, clonedElement);
                container.appendChild(wrapper);
              }
            });

            previewRef.current!.innerHTML = '';
            previewRef.current!.appendChild(container);
          }
        } finally {
          document.body.removeChild(sandbox);
        }
      });
    } catch (error) {
      console.error('预览更新失败:', error);
      previewRef.current.innerHTML = '<div class="text-red-500">预览更新失败</div>';
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setHtmlCode(value);
      // 如果有选中的类名，使用新代码更新预览
      if (previewOnly) {
        updatePreview(value, previewOnly);
      } else {
        updatePreview(value);
      }
      // 更新可用的类名列表
      const classes = extractClassNames(value);
      setAvailableClasses(classes);
    }
  };

  const generateStaticHtml = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);
      const currentHtml = previewRef.current.innerHTML;
      setHtmlCode(currentHtml);
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

      // 在导出前应用字体和外部样式
      const element = previewRef.current;
      const fonts = document.fonts;
      await fonts.ready; // 等待字体加载

      // 创建一个新的容器用于导出
      const exportContainer = document.createElement('div');
      exportContainer.style.background = '#ffffff';
      exportContainer.style.width = '800px'; // 固定宽度以确保一致性
      exportContainer.style.padding = '20px';
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.innerHTML = element.innerHTML;

      document.body.appendChild(exportContainer);

      // 使用更高的比例以获得更好的质量
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        foreignObjectRendering: true,
        // 确保渲染所有背景
        onclone: (doc) => {
          const elements = doc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const computed = window.getComputedStyle(el);
            el.style.background = computed.background;
          }
        }
      });

      // 移除临时容器
      document.body.removeChild(exportContainer);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      const pageWidth = 210; // A4 宽度(mm)
      const pageHeight = 297; // A4 高度(mm)
      
      // 计算缩放比例以适应 PDF 页面宽度
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      let page = 1;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');

      while (heightLeft >= pageHeight) {
        position = -pageHeight * page;
        page++;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save('exported.pdf');
    } catch (error: any) {
      console.error('导出PDF失败:', error);
      alert('导出PDF时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 处理类名选择变化
  const handleClassSelect = (className: string) => {
    setTargetClass(className);
    setPreviewOnly(className);
    updatePreview(htmlCode, className);
  };

  // 初始化
  useEffect(() => {
    const classes = extractClassNames(htmlCode);
    setAvailableClasses(classes);
    updatePreview(htmlCode);
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
