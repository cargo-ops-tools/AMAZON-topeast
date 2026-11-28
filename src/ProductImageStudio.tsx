import { useEffect, useRef, useState } from "react";

export default function ProductImageStudio({ active }: { active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [height, setHeight] = useState(820);
  const observer = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <div className="module-screen" hidden={!active}>
      {opened && (
        <iframe
          title="产品图生成与款式评审"
          src="./product-images/index.html"
          style={{ display: "block", width: "100%", height, border: 0 }}
          onLoad={(event) => {
            const body = event.currentTarget.contentDocument?.body;
            if (!body) return;
            observer.current?.disconnect();
            const resize = () => {
              const measured = Math.ceil(body.getBoundingClientRect().height);
              if (measured > 0) setHeight(measured);
            };
            resize();
            observer.current = new ResizeObserver(resize);
            observer.current.observe(body);
          }}
        />
      )}
    </div>
  );
}
