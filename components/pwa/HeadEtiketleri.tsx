export default function HeadEtiketleri() {
  const startupScreens = [
    [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
    [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
    [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  ];

  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      {startupScreens.map(([width, height, ratio]) => (
        <link
          key={`${width}x${height}@${ratio}`}
          rel="apple-touch-startup-image"
          href={`/acilis/acilis-${width}x${height}@${ratio}x.png`}
          media={`(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`}
        />
      ))}
    </>
  );
}
