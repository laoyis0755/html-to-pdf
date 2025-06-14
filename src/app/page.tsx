'use client';

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import opentype from 'opentype.js';

interface StyleGroups {
  layout: string[];
  positioning: string[];
  background: string[];
  text: string[];
  effects: string[];
  animation: string[];
  interaction: string[];
}

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
    
    // 复制计算样式
    try {
      // 布局相关样式
      [
        'display', 'flex-direction', 'flex-wrap', 'justify-content',
        'align-items', 'align-content', 'gap', 'grid-template-columns',
        'grid-template-rows', 'grid-gap', 'margin', 'padding', 'width',
        'height', 'min-width', 'min-height', 'max-width', 'max-height'
      ].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'none' && value !== 'auto') {
          target.style.setProperty(prop, value);
        }
      });

      // 定位和变换
      [
        'position', 'top', 'right', 'bottom', 'left', 'z-index',
        'transform', 'transform-origin', 'transform-style',
        'perspective', 'perspective-origin'
      ].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'none' && value !== 'static') {
          target.style.setProperty(prop, value);
        }
      });

      // 背景相关
      const background = computedStyle.getPropertyValue('background');
      if (background.includes('gradient')) {
        // 特殊处理渐变背景
        target.style.background = background;
      } else {
        [
          'background-color', 'background-image', 'background-repeat',
          'background-position', 'background-size', 'background-attachment',
          'background-clip', 'background-origin'
        ].forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value !== 'none') {
            target.style.setProperty(prop, value);
          }
        });
      }

      // 边框和圆角
      [
        'border', 'border-radius', 'border-color', 'border-width',
        'border-style', 'box-shadow', 'outline'
      ].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'none') {
          target.style.setProperty(prop, value);
        }
      });

      // 文本样式
      [
        'color', 'font-family', 'font-size', 'font-weight', 'font-style',
        'line-height', 'letter-spacing', 'text-align', 'text-transform',
        'text-decoration', 'text-shadow', 'white-space'
      ].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'normal') {
          target.style.setProperty(prop, value);
        }
      });

      // 特效和滤镜
      ['opacity', 'filter', 'backdrop-filter'].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'none') {
          target.style.setProperty(prop, value);
        }
      });

      // 混合模式
      ['mix-blend-mode', 'isolation'].forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'normal') {
          target.style.setProperty(prop, value);
        }
      });

    } catch (e) {
      console.warn('复制计算样式时出错:', e);
    }

    // 处理伪元素
    ['::before', '::after'].forEach(pseudo => {
      try {
        const pseudoStyle = window.getComputedStyle(source, pseudo);
        const content = pseudoStyle.getPropertyValue('content');
        
        if (content && content !== 'none' && content !== '') {
          const pseudoElement = document.createElement('span');
          pseudoElement.setAttribute('data-pseudo', pseudo);
          
          // 复制所有伪元素样式
          Array.from(pseudoStyle).forEach(prop => {
            try {
              const value = pseudoStyle.getPropertyValue(prop);
              if (value && value !== 'none' && value !== 'normal') {
                pseudoElement.style.setProperty(prop, value);
              }
            } catch (e) {
              // 忽略不支持的属性
            }
          });
          
          // 特殊处理定位
          pseudoElement.style.position = 'absolute';
          if (pseudo === '::before') {
            if (target.firstChild) {
              target.insertBefore(pseudoElement, target.firstChild);
            } else {
              target.appendChild(pseudoElement);
            }
          } else {
            target.appendChild(pseudoElement);
          }
        }
      } catch (e) {
        console.warn(`处理伪元素 ${pseudo} 时出错:`, e);
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

      // 确保字体和图标的样式被保留
      const styleLinks = Array.from(document.getElementsByTagName('link'))
        .filter(link => link.rel === 'stylesheet')
        .map(link => link.cloneNode(true));
      
      const tempHead = document.createElement('div');
      styleLinks.forEach(link => tempHead.appendChild(link));
      
      sandbox.innerHTML = `
        ${tempHead.innerHTML}
        ${code}
      `;
      document.body.appendChild(sandbox);

      // 等待样式计算
      requestAnimationFrame(() => {
        try {
          if (!previewClass) {
            // 完整预览模式
            previewRef.current!.innerHTML = code;
          } else {
            const targetElements = sandbox.getElementsByClassName(previewClass);
            if (targetElements.length === 0) {
              previewRef.current!.innerHTML = '<div class="text-gray-500">没有找到指定类名的元素</div>';
              return;
            }

            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '20px';

            // 获取每个目标元素
            Array.from(targetElements).forEach(element => {
              if (element instanceof HTMLElement) {
                // 克隆元素及其内容
                const elementClone = element.cloneNode(true) as HTMLElement;
                
                // 先获取所有计算样式
                const computedStyles = window.getComputedStyle(element);
                
                // 处理 header 元素的特殊情况
                if (element.classList.contains('header')) {
                  // 保持渐变背景
                  const background = computedStyles.getPropertyValue('background');
                  elementClone.style.background = background;
                  elementClone.style.width = '100%';
                  
                  // 确保装饰元素正确定位
                  const decorElements = elementClone.getElementsByClassName('flower-decor');
                  if (decorElements.length > 0 && decorElements[0] instanceof HTMLElement) {
                    const decor = decorElements[0] as HTMLElement;
                    decor.style.position = 'absolute';
                    decor.style.right = '20px';
                    decor.style.top = '20px';
                    decor.style.opacity = '0.15';
                    decor.style.fontSize = '100px';
                  }
                  
                  // 确保内容元素正确定位
                  const contentElements = elementClone.getElementsByClassName('header-content');
                  if (contentElements.length > 0 && contentElements[0] instanceof HTMLElement) {
                    const content = contentElements[0] as HTMLElement;
                    content.style.position = 'relative';
                    content.style.zIndex = '2';
                    
                    // 修复 slogan 样式
                    const sloganElements = content.getElementsByClassName('slogan');
                    if (sloganElements.length > 0 && sloganElements[0] instanceof HTMLElement) {
                      const slogan = sloganElements[0] as HTMLElement;
                      const sloganStyles = window.getComputedStyle(element.querySelector('.slogan')!);
                      slogan.style.cssText = `
                        font-size: ${sloganStyles.fontSize};
                        font-style: italic;
                        margin-top: 20px;
                        opacity: 0.85;
                        background: rgba(255, 255, 255, 0.15);
                        padding: 8px 15px;
                        border-radius: 50px;
                        display: inline-block;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      `;
                    }
                  }
                }
                
                // 创建包装容器并设置宽度
                const wrapper = document.createElement('div');
                wrapper.style.width = '100%';
                
                // 复制原始元素的尺寸
                const rect = element.getBoundingClientRect();
                elementClone.style.width = '100%';
                elementClone.style.minHeight = rect.height + 'px';
                
                // 复制所有重要的样式属性
                [
                  'padding', 'margin', 'border', 'border-radius',
                  'box-shadow', 'color', 'font-family', 'font-size',
                  'line-height', 'text-align', 'background', 'position',
                  'display', 'align-items', 'justify-content',
                  'flex-direction', 'gap', 'overflow'
                ].forEach(prop => {
                  const value = computedStyles.getPropertyValue(prop);
                  if (value) elementClone.style.setProperty(prop, value);
                });
                
                // 处理子元素
                const processChildren = (parent: Element, clone: Element) => {
                  Array.from(parent.children).forEach((child, index) => {
                    if (child instanceof HTMLElement && clone.children[index] instanceof HTMLElement) {
                      const childClone = clone.children[index] as HTMLElement;
                      const childStyles = window.getComputedStyle(child);
                      
                      // 复制子元素的样式
                      [
                        'position', 'top', 'left', 'right', 'bottom',
                        'width', 'height', 'padding', 'margin', 'color',
                        'font-size', 'font-weight', 'line-height',
                        'text-align', 'background', 'z-index',
                        'display', 'align-items', 'opacity',
                        'white-space', 'overflow', 'text-overflow'
                      ].forEach(prop => {
                        const value = childStyles.getPropertyValue(prop);
                        if (value) childClone.style.setProperty(prop, value);
                      });
                      
                      // 递归处理更深层级的子元素
                      processChildren(child, childClone);
                    }
                  });
                };
                
                processChildren(element, elementClone);
                wrapper.appendChild(elementClone);
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

      // 创建一个临时容器来处理样式
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = previewRef.current.innerHTML;

      // 移除所有脚本标签
      const scripts = tempContainer.getElementsByTagName('script');
      while (scripts.length > 0) {
        scripts[0].parentNode?.removeChild(scripts[0]);
      }

      // 移除 Vue 相关属性
      const allElements = tempContainer.getElementsByTagName('*');
      Array.from(allElements).forEach(el => {
        // 移除 Vue 指令和事件监听器
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
          if (attr.name.startsWith('v-') || 
              attr.name.startsWith('@') || 
              attr.name.startsWith(':') ||
              attr.name === 'data-v-app') {
            el.removeAttribute(attr.name);
          }
        });
      });

      // 处理所有元素的样式
      const processElements = (elements: HTMLElement[]) => {
        elements.forEach(el => {
          const computedStyle = window.getComputedStyle(el);
          
          // 样式属性分组
          const styleGroups = {
            // 布局相关
            layout: [
              // Flexbox
              'display', 'flex-direction', 'flex-wrap', 'flex-flow', 'flex-grow',
              'flex-shrink', 'flex-basis', 'flex', 'justify-content', 'align-items',
              'align-self', 'align-content', 'gap', 'row-gap', 'column-gap',
              'order', 'flex-flow',
              // Grid
              'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
              'grid-template', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
              'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
              'grid-column', 'grid-row', 'grid-area', 'grid-gap',
              // Box Model
              'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
              'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
              'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
              'box-sizing', 'border', 'border-radius'
            ],
            
            // 定位相关
            positioning: [
              'position', 'top', 'right', 'bottom', 'left', 'z-index',
              'float', 'clear', 'transform', 'transform-origin', 'transform-style',
              'perspective', 'perspective-origin', 'backface-visibility',
              'clip', 'clip-path', 'contain'
            ],
            
            // 背景相关
            background: [
              'background', 'background-color', 'background-image',
              'background-repeat', 'background-position', 'background-size',
              'background-attachment', 'background-origin', 'background-clip',
              'background-blend-mode', 'isolation', 'mix-blend-mode'
            ],
            
            // 文本相关
            text: [
              'color', 'font-family', 'font-size', 'font-weight', 'font-style',
              'font-variant', 'font-stretch', 'font-kerning', 'font-feature-settings',
              'line-height', 'letter-spacing', 'word-spacing', 'text-align',
              'text-transform', 'text-decoration', 'text-shadow', 'text-rendering',
              'text-overflow', 'white-space', 'word-break', 'word-wrap',
              'writing-mode', 'vertical-align', 'unicode-bidi', 'direction',
              'text-combine-upright', 'text-orientation'
            ],
            
            // 效果相关
            effects: [
              'opacity', 'visibility', 'box-shadow', 'text-shadow',
              'filter', 'backdrop-filter', 'mask', 'mask-image',
              'clip-path', 'pointer-events', 'overflow', 'overflow-x', 'overflow-y',
              'scroll-behavior', 'scroll-snap-type', 'scroll-snap-align',
              'object-fit', 'object-position'
            ],
            
            // 动画相关
            animation: [
              'transition', 'transition-property', 'transition-duration',
              'transition-timing-function', 'transition-delay',
              'animation', 'animation-name', 'animation-duration',
              'animation-timing-function', 'animation-delay',
              'animation-iteration-count', 'animation-direction',
              'animation-fill-mode', 'animation-play-state',
              'will-change'
            ],
            
            // 交互相关
            interaction: [
              'cursor', 'pointer-events', 'user-select', 'resize',
              'touch-action', 'scroll-behavior', 'overscroll-behavior',
              'appearance', '-webkit-appearance'
            ]
          };

          // 处理每个样式组
          Object.values(styleGroups).flat().forEach(prop => {
            try {
              const value = computedStyle.getPropertyValue(prop);
              if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
                // 处理特殊属性
                if (prop.includes('background') && value.includes('gradient')) {
                  // 保存完整的渐变字符串
                  el.style.setProperty(prop, value);
                } else if (prop === 'transform' && value !== 'none') {
                  // 确保变换属性正确应用
                  el.style.transform = value;
                  const origin = computedStyle.getPropertyValue('transform-origin');
                  if (origin) el.style.transformOrigin = origin;
                } else if (prop.startsWith('filter') && value !== 'none') {
                  // 确保滤镜效果正确应用
                  el.style.setProperty(prop, value);
                } else {
                  // 尝试保留带前缀的属性
                  const prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
                  prefixes.forEach(prefix => {
                    const prefixedProp = prefix + prop;
                    const prefixedValue = computedStyle.getPropertyValue(prefixedProp);
                    if (prefixedValue && prefixedValue !== 'none' && prefixedValue !== 'auto' && prefixedValue !== 'normal') {
                      try {
                        el.style.setProperty(prefixedProp, prefixedValue);
                      } catch (e) {
                        console.warn(`无法设置属性 ${prefixedProp}:`, e);
                      }
                    }
                  });
                }
              }
            } catch (e) {
              console.warn(`处理样式属性 ${prop} 时出错:`, e);
            }
          });

          // 特殊处理伪元素
          ['::before', '::after'].forEach(pseudo => {
            try {
              const pseudoStyle = window.getComputedStyle(el, pseudo);
              const content = pseudoStyle.getPropertyValue('content');
              
              if (content && content !== 'none' && content !== '') {
                const pseudoElement = document.createElement('span');
                pseudoElement.setAttribute('data-pseudo', pseudo);
                
                // 复制伪元素的所有样式
                Object.values(styleGroups).flat().forEach(prop => {
                  try {
                    const value = pseudoStyle.getPropertyValue(prop);
                    if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
                      // 特殊处理定位属性
                      if (prop === 'position') {
                        pseudoElement.style.position = 'absolute';
                      } else if (['top', 'right', 'bottom', 'left'].includes(prop)) {
                        pseudoElement.style[prop as any] = value;
                      } else {
                        pseudoElement.style.setProperty(prop, value);
                      }
                    }
                  } catch (e) {
                    console.warn(`处理伪元素样式 ${prop} 时出错:`, e);
                  }
                });

                // 插入伪元素
                if (pseudo === '::before') {
                  if (el.firstChild) {
                    el.insertBefore(pseudoElement, el.firstChild);
                  } else {
                    el.appendChild(pseudoElement);
                  }
                } else {
                  el.appendChild(pseudoElement);
                }
              }
            } catch (e) {
              console.warn(`处理伪元素 ${pseudo} 时出错:`, e);
            }
          });

          // 特殊处理渐变和背景
          const background = computedStyle.getPropertyValue('background');
          if (background.includes('gradient')) {
            el.style.background = background;
          }

          // 处理多重背景
          const backgroundImages = computedStyle.getPropertyValue('background-image');
          if (backgroundImages && backgroundImages !== 'none') {
            el.style.backgroundImage = backgroundImages;
          }

          // 处理变换和透视
          if (computedStyle.transform !== 'none') {
            el.style.transform = computedStyle.transform;
            el.style.transformOrigin = computedStyle.transformOrigin;
            if (computedStyle.perspective !== 'none') {
              el.style.perspective = computedStyle.perspective;
              el.style.perspectiveOrigin = computedStyle.perspectiveOrigin;
            }
          }

          // 处理遮罩和剪切
          if (computedStyle.clipPath !== 'none') {
            el.style.clipPath = computedStyle.clipPath;
          }
          if (computedStyle.mask !== 'none') {
            el.style.mask = computedStyle.mask;
          }

          // 确保滤镜效果正确应用
          ['filter', 'backdrop-filter'].forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none') {
              el.style[prop as any] = value;
            }
          });
        });
      };

      // 处理所有元素及其子元素
      const elements = Array.from(tempContainer.getElementsByTagName('*')) as HTMLElement[];
      processElements([tempContainer as HTMLElement, ...elements]);

      // 获取处理后的 HTML
      const processedHtml = tempContainer.outerHTML;
      
      // 设置为编辑器的值
      setHtmlCode(processedHtml);

      // 更新预览
      if (previewOnly) {
        updatePreview(processedHtml, previewOnly);
      } else {
        updatePreview(processedHtml);
      }
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
      
      // 确保字体和图标加载
      const fontAwesomeLink = document.createElement('link');
      fontAwesomeLink.rel = 'stylesheet';
      fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(fontAwesomeLink);

      // 等待字体加载完成
      await new Promise((resolve) => {
        fontAwesomeLink.onload = resolve;
      });

      exportContainer.style.cssText = `
        background: #ffffff;
        width: 800px;
        padding: 20px;
        position: fixed;
        top: 0;
        left: -9999px;
        font-family: 'Noto Sans SC', Arial, sans-serif;
      `;
      
      // 保持所有图标和样式
      const styleLinks = Array.from(document.getElementsByTagName('link'))
        .filter(link => link.rel === 'stylesheet')
        .map(link => link.cloneNode(true));
      
      const tempHead = document.createElement('div');
      styleLinks.forEach(link => tempHead.appendChild(link));
      
      exportContainer.innerHTML = `
        ${tempHead.innerHTML}
        ${element.innerHTML}
      `;

      // 修复渐变背景和布局
      const headers = exportContainer.getElementsByClassName('header');
      Array.from(headers).forEach(header => {
        if (header instanceof HTMLElement) {
          header.style.background = 'linear-gradient(120deg, #405de6, #5851db, #833ab4, #c13584, #e1306c, #fd1d1d)';
          header.style.position = 'relative';
          header.style.overflow = 'hidden';
          
          const decorElements = header.getElementsByClassName('flower-decor');
          if (decorElements.length > 0 && decorElements[0] instanceof HTMLElement) {
            const decor = decorElements[0] as HTMLElement;
            decor.style.position = 'absolute';
            decor.style.right = '20px';
            decor.style.top = '20px';
            decor.style.opacity = '0.15';
          }
          
          const contentElements = header.getElementsByClassName('header-content');
          if (contentElements.length > 0 && contentElements[0] instanceof HTMLElement) {
            const content = contentElements[0] as HTMLElement;
            content.style.position = 'relative';
            content.style.zIndex = '2';
          }
        }
      });

      document.body.appendChild(exportContainer);

      // 使用更高的比例以获得更好的质量
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (doc) => {
          // 确保所有样式都被正确应用
          const copyStyles = (source: HTMLElement, target: HTMLElement) => {
            const styles = window.getComputedStyle(source);
            Array.from(styles).forEach(key => {
              target.style.setProperty(key, styles.getPropertyValue(key));
            });
          };

          const sourceElements = doc.getElementsByTagName('*');
          Array.from(sourceElements).forEach(el => {
            if (el instanceof HTMLElement) {
              const computed = window.getComputedStyle(el);
              copyStyles(el, el);
              el.style.transform = 'none';
              el.style.transition = 'none';
            }
          });
        }
      });

      document.body.removeChild(exportContainer);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = 210; // A4 宽度(mm)
      const pageHeight = 297; // A4 高度(mm)
      
      // 计算缩放比例以适应 PDF 页面宽度
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);

      while (heightLeft >= pageHeight) {
        position = -pageHeight;
        heightLeft -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      }

      pdf.save('exported.pdf');
    } catch (error: any) {
      console.error('导出PDF失败:', error);
      alert('导出PDF时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const exportToJpg = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);

      // 在导出前应用字体和外部样式
      const element = previewRef.current;
      await document.fonts.ready;

      // 创建一个新的容器用于导出
      const exportContainer = document.createElement('div');
      
      // 确保字体和图标加载
      const fontAwesomeLink = document.createElement('link');
      fontAwesomeLink.rel = 'stylesheet';
      fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(fontAwesomeLink);

      // 等待字体加载完成
      await new Promise((resolve) => {
        fontAwesomeLink.onload = resolve;
      });

      exportContainer.style.cssText = `
        background: #ffffff;
        width: 1920px;
        padding: 20px;
        position: fixed;
        top: 0;
        left: -9999px;
        font-family: 'Noto Sans SC', Arial, sans-serif;
      `;
      
      // 保持所有图标和样式
      const styleLinks = Array.from(document.getElementsByTagName('link'))
        .filter(link => link.rel === 'stylesheet')
        .map(link => link.cloneNode(true));
      
      const tempHead = document.createElement('div');
      styleLinks.forEach(link => tempHead.appendChild(link));
      
      exportContainer.innerHTML = `${tempHead.innerHTML}${element.innerHTML}`;
      document.body.appendChild(exportContainer);

      // 使用更高的比例以获得更好的质量
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (doc) => {
          const copyStyles = (source: HTMLElement, target: HTMLElement) => {
            const styles = window.getComputedStyle(source);
            Array.from(styles).forEach(key => {
              target.style.setProperty(key, styles.getPropertyValue(key));
            });
          };

          const sourceElements = doc.getElementsByTagName('*');
          Array.from(sourceElements).forEach(el => {
            if (el instanceof HTMLElement) {
              copyStyles(el, el);
              el.style.transform = 'none';
              el.style.transition = 'none';
            }
          });
        }
      });

      document.body.removeChild(exportContainer);

      // 创建下载链接
      const link = document.createElement('a');
      link.download = 'exported.jpg';
      link.href = canvas.toDataURL('image/jpeg', 1.0);
      link.click();
    } catch (error: any) {
      console.error('导出JPG失败:', error);
      alert('导出JPG时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const exportToSvg = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);

      // 在导出前应用字体和外部样式
      const element = previewRef.current;
      await document.fonts.ready;

      // 创建一个新的容器用于导出
      const exportContainer = document.createElement('div');
      
      // 确保字体和图标加载
      const fontAwesomeLink = document.createElement('link');
      fontAwesomeLink.rel = 'stylesheet';
      fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(fontAwesomeLink);

      // 等待字体加载完成
      await new Promise((resolve) => {
        fontAwesomeLink.onload = resolve;
      });

      // 克隆当前内容
      const clone = element.cloneNode(true) as HTMLElement;
      
      // 收集所有计算样式
      const collectStyles = (el: HTMLElement): string => {
        const style = window.getComputedStyle(el);
        let css = '{';
        for (const prop of style) {
          const value = style.getPropertyValue(prop);
          if (value) {
            css += `${prop}:${value};`;
          }
        }
        css += '}';
        return css;
      };

      // 递归处理所有元素
      const processElement = (el: HTMLElement) => {
        const style = collectStyles(el);
        el.setAttribute('style', style);
        Array.from(el.children).forEach(child => {
          if (child instanceof HTMLElement) {
            processElement(child);
          }
        });
      };

      processElement(clone as HTMLElement);

      // 创建SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '1920');
      svg.setAttribute('height', element.offsetHeight.toString());
      
      // 创建外来对象
      const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObject.setAttribute('width', '100%');
      foreignObject.setAttribute('height', '100%');
      foreignObject.appendChild(clone);
      svg.appendChild(foreignObject);

      // 将SVG转换为字符串
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      
      // 创建下载链接
      const link = document.createElement('a');
      link.download = 'exported.svg';
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error: any) {
      console.error('导出SVG失败:', error);
      alert('导出SVG时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 转换ArrayBuffer为base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const uint8Array = new Uint8Array(buffer);
    let binaryString = '';
    uint8Array.forEach(byte => {
      binaryString += String.fromCharCode(byte);
    });
    return btoa(binaryString);
  };

  // 优化的SVG导出函数
  const exportToSvgWithP = async () => {
    if (!previewRef.current) return;
    try {
      setLoading(true);

      // 等待字体加载
      await document.fonts.ready;

      // 创建一个新的容器
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // 克隆内容
      const clone = previewRef.current.cloneNode(true) as HTMLElement;

      // 清理Vue相关属性
      cleanVueAttributes(clone);
      
      // 处理动态类
      const allElements = clone.getElementsByTagName('*');
      Array.from(allElements).forEach(resolveDynamicClasses);

      // 内联所有样式
      const inlineStyles = (element: HTMLElement) => {
        const styles = window.getComputedStyle(element);
        let inlineStyle = '';
        
        // 收集所有非空的样式
        for (const prop of styles) {
          const value = styles.getPropertyValue(prop);
          if (value && value !== 'initial' && value !== 'none') {
            inlineStyle += `${prop}:${value};`;
          }
        }
        
        if (inlineStyle) {
          element.setAttribute('style', inlineStyle);
        }

        // 递归处理子元素
        Array.from(element.children).forEach(child => {
          if (child instanceof HTMLElement) {
            inlineStyles(child);
          }
        });
      };

      inlineStyles(clone);
      container.appendChild(clone);

      // 创建SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '800');
      svg.setAttribute('height', container.offsetHeight.toString());
      svg.setAttribute('viewBox', `0 0 800 ${container.offsetHeight}`);

      // 加载并嵌入字体
      try {
        const faFontBuffer = await loadFont('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.ttf');
        const notoFontBuffer = await loadFont('https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeALhL4iJ-Q-m7KaA.ttf');

        // 添加SVG样式
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
          @font-face {
            font-family: 'Font Awesome 6 Free';
            font-style: normal;
            font-weight: 900;
            font-display: block;
            src: url(data:font/ttf;base64,${arrayBufferToBase64(faFontBuffer)}) format('truetype');
          }
          @font-face {
            font-family: 'Noto Sans SC';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: url(data:font/ttf;base64,${arrayBufferToBase64(notoFontBuffer)}) format('truetype');
          }
        `;
        svg.appendChild(style);
      } catch (error) {
        console.warn('加载字体失败:', error);
      }

      // 创建 foreignObject
      const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObject.setAttribute('width', '100%');
      foreignObject.setAttribute('height', '100%');
      foreignObject.setAttribute('x', '0');
      foreignObject.setAttribute('y', '0');

      // 处理所有文本节点
      await processTextToPath(clone);

      // 添加处理后的内容到 foreignObject
      foreignObject.innerHTML = clone.outerHTML;
      svg.appendChild(foreignObject);

      // 序列化 SVG
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);

      // 清理SVG字符串中的外部依赖
      svgString = svgString.replace(/<link[^>]*>/g, '');
      svgString = svgString.replace(/@import[^;]*;/g, '');

      // 添加XML声明
      svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
${svgString}`;

      // 创建下载链接
      const link = document.createElement('a');
      link.download = 'exported-standalone.svg';
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);

      // 清理
      document.body.removeChild(container);
    } catch (error: any) {
      console.error('导出SVG失败:', error);
      alert('导出SVG时发生错误：' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 清理 Vue 相关属性的函数
  const cleanVueAttributes = (element: Element) => {
    // 移除所有 Vue 相关属性
    const attrs = Array.from(element.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('v-') || 
          attr.name.startsWith(':') || 
          attr.name.startsWith('@') ||
          attr.name.includes('data-v')) {
        element.removeAttribute(attr.name);
      }
    });

    // 处理子元素
    Array.from(element.children).forEach(child => {
      cleanVueAttributes(child);
    });

    // 如果是空的绑定表达式 {{ }}，替换为空字符串
    if (element.textContent && element.textContent.trim().match(/^{{.*}}$/)) {
      element.textContent = '';
    }
  };

  // 处理动态绑定的 class
  const resolveDynamicClasses = (element: Element) => {
    const dynamicClass = element.getAttribute(':class');
    if (dynamicClass) {
      // 如果是 active 类的绑定，根据当前状态确定是否应该有这个类
      if (dynamicClass.includes('active')) {
        element.classList.add('active');
      }
      element.removeAttribute(':class');
    }
  };

  // 获取 Font Awesome 图标的 SVG 路径
  const getIconPath = async (element: Element): Promise<string | null> => {
    try {
      // 获取图标的 Unicode
      const iconClass = Array.from(element.classList)
        .find(cls => cls.startsWith('fa-'))
        ?.substring(3);
      
      if (!iconClass) return null;

      // 从 Font Awesome 获取 SVG 数据
      const response = await fetch(`https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/svgs/solid/${iconClass}.svg`);
      if (!response.ok) return null;

      const svgText = await response.text();
      const pathMatch = svgText.match(/<path[^>]*d="([^"]*)"[^>]*>/);
      return pathMatch ? pathMatch[1] : null;
    } catch (error) {
      console.warn('获取图标路径失败:', error);
      return null;
    }
  };

  // 定义路径命令的类型
  type PathCommandBase = {
    type: string;
  };

  type MoveCommand = PathCommandBase & {
    type: 'M';
    x: number;
    y: number;
  };

  type LineCommand = PathCommandBase & {
    type: 'L';
    x: number;
    y: number;
  };

  type CurveCommand = PathCommandBase & {
    type: 'C';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
  };

  type QuadCommand = PathCommandBase & {
    type: 'Q';
    x1: number;
    y1: number;
    x: number;
    y: number;
  };

  type CloseCommand = PathCommandBase & {
    type: 'Z';
  };

  type PathCommand = MoveCommand | LineCommand | CurveCommand | QuadCommand | CloseCommand;

  // 加载字体文件
  const loadFont = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load font: ${url}`);
    return await response.arrayBuffer();
  };

  // 更新文本转路径函数
  const textToPath = async (text: string, style: CSSStyleDeclaration): Promise<string> => {
    try {
      // 确定字体URL
      const fontUrl = style.fontFamily.includes('Font Awesome') 
        ? 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.ttf'
        : 'https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeALhL4iJ-Q-m7KaA.ttf';

      // 加载字体数据
      const fontData = await loadFont(fontUrl);
      const font = await opentype.parse(fontData);
      
      const fontSize = parseFloat(style.fontSize);
      const path = font.getPath(text, 0, 0, fontSize);
      
      // 应用字体权重
      if (style.fontWeight !== 'normal' && style.fontWeight !== '400') {
        path.commands.forEach((cmd: any) => {
          const weight = parseInt(style.fontWeight) / 400;
          if (cmd.type !== 'Z') {
            cmd.x *= weight;
            cmd.y *= weight;
          }
          
          // 只处理贝塞尔曲线的控制点
          if (cmd.type === 'C') {
            cmd.x1 *= weight;
            cmd.y1 *= weight;
            cmd.x2 *= weight;
            cmd.y2 *= weight;
          } else if (cmd.type === 'Q') {
            cmd.x1 *= weight;
            cmd.y1 *= weight;
          }
        });
      }
      
      return path.toPathData(2);
    } catch (error) {
      console.warn('文本转路径失败:', error);
      return '';
    }
  };

  // 进一步优化处理文本到路径的转换
  const processTextToPath = async (el: Element) => {
    if (el instanceof HTMLElement) {
      const styles = window.getComputedStyle(el);
      const text = el.innerText;
      
      if (text && text.trim()) {
        try {
          const pathData = await textToPath(text, styles);
          if (pathData) {
            // 创建SVG文本容器
            const textContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            textContainer.setAttribute('fill', styles.color);
            
            // 创建实际的路径
            const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            svgPath.setAttribute('d', pathData);
            
            // 应用文本装饰（如下划线）
            if (styles.textDecoration.includes('underline')) {
              const underline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              const fontSize = parseFloat(styles.fontSize);
              underline.setAttribute('d', `M0 ${fontSize * 1.1} H${el.offsetWidth}`);
              underline.setAttribute('stroke', styles.color);
              underline.setAttribute('stroke-width', '1');
              textContainer.appendChild(underline);
            }
            
            // 添加路径到容器
            textContainer.appendChild(svgPath);
            
            // 设置变换以正确定位文本
            textContainer.setAttribute('transform', 
              `translate(${el.offsetLeft},${el.offsetTop + parseFloat(styles.fontSize)})`
            );
            
            // 替换原始内容
            el.innerHTML = '';
            el.appendChild(textContainer);
          }
        } catch (error) {
          console.warn('处理文本转路径失败:', error);
        }
      }

      // 优化内联样式处理
      const relevantStyles = [
        'position', 'top', 'left', 'right', 'bottom',
        'display', 'margin', 'padding', 'width', 'height',
        'background', 'border', 'box-shadow',
        'opacity', 'visibility', 'z-index',
        'transform', 'transition'
      ];

      let inlineStyle = relevantStyles
        .map(prop => {
          const value = styles.getPropertyValue(prop);
          return value ? `${prop}:${value};` : '';
        })
        .filter(Boolean)
        .join('');

      if (inlineStyle) {
        el.setAttribute('style', inlineStyle);
      }
    }

    // 递归处理子元素
    for (const child of el.children) {
      await processTextToPath(child);
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
    // 加载字体和图标
    const loadFontsAndIcons = async () => {
      // 加载 Font Awesome
      if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);
      }

      // 加载 Google Fonts
      if (!document.querySelector('link[href*="googleapis"]')) {
        const googleFontsLink = document.createElement('link');
        googleFontsLink.rel = 'stylesheet';
        googleFontsLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap';
        document.head.appendChild(googleFontsLink);
      }

      // 等待字体加载
      await document.fonts.ready;
    };

    loadFontsAndIcons();
    const classes = extractClassNames(htmlCode);
    setAvailableClasses(classes);
    updatePreview(htmlCode);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-blue-800 mb-8 text-center">
          HTML 转换工具
          <span className="block text-sm font-normal text-blue-600 mt-2">支持导出 PDF、JPG、SVG 格式</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 编辑器部分 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-blue-700 text-white p-4 flex items-center">
              <h2 className="font-medium">HTML 编辑器</h2>
            </div>
            <div className="border border-blue-100">
              <Editor
                height="600px"
                defaultLanguage="html"
                value={htmlCode}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  theme: 'light',
                }}
              />
            </div>
          </div>

          {/* 预览部分 */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-blue-700 text-white p-4 flex justify-between items-center">
                <h2 className="font-medium">实时预览</h2>
                {previewOnly && (
                  <button
                    onClick={() => {
                      setPreviewOnly(null);
                      setTargetClass('');
                      updatePreview(htmlCode);
                    }}
                    className="text-sm text-blue-100 hover:text-white transition-colors"
                  >
                    显示完整预览
                  </button>
                )}
              </div>
              <div className="p-6">
                <div
                  ref={previewRef}
                  className="border border-blue-100 rounded-lg p-6 min-h-[600px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 导出选项部分 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* 选择要导出的元素 */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <label htmlFor="targetClass" className="text-blue-900 font-medium mb-3 block">
              选择要导出的元素
            </label>
            <div className="space-y-3">
              <input
                type="text"
                id="targetClass"
                value={targetClass}
                onChange={(e) => handleClassSelect(e.target.value)}
                className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                placeholder="输入要导出的元素的类名"
                list="class-suggestions"
              />
              <div className="flex gap-4 items-center">
                <select
                  value={targetClass}
                  onChange={(e) => handleClassSelect(e.target.value)}
                  className="flex-1 p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white transition-all"
                >
                  <option value="">-- 选择类名 --</option>
                  {availableClasses.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-blue-600 whitespace-nowrap">
                  留空则导出所有内容
                </div>
              </div>
            </div>
          </div>

          {/* 导出按钮部分 */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="space-y-4">
              <button
                onClick={generateStaticHtml}
                disabled={loading}
                className={`w-full ${
                  loading
                    ? 'bg-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                } text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200`}
              >
                {loading ? '处理中...' : '生成静态 HTML'}
              </button>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={exportToPdf}
                  disabled={loading}
                  className={`w-full ${
                    loading
                      ? 'bg-gray-300'
                      : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                  } text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200`}
                >
                  {loading ? '导出中...' : '导出 PDF'}
                </button>
                <button
                  onClick={exportToJpg}
                  disabled={loading}
                  className={`w-full ${
                    loading
                      ? 'bg-gray-300'
                      : 'bg-blue-400 hover:bg-blue-500 active:bg-blue-600'
                  } text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200`}
                >
                  {loading ? '导出中...' : '导出 JPG'}
                </button>
                <button
                  onClick={exportToSvg}
                  disabled={loading}
                  className={`w-full ${
                    loading
                      ? 'bg-gray-300'
                      : 'bg-blue-400 hover:bg-blue-500 active:bg-blue-600'
                  } text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200`}
                >
                  {loading ? '导出中...' : '导出 SVG'}
                </button>
                <button
                  onClick={exportToSvgWithP}
                  disabled={loading}
                  className={`w-full ${
                    loading
                      ? 'bg-gray-300'
                      : 'bg-indigo-400 hover:bg-indigo-500 active:bg-indigo-600'
                  } text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200`}
                >
                  {loading ? '导出中...' : '导出 SVG (P标签版)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
