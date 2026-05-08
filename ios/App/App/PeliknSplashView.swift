import UIKit
import WebKit
import Capacitor

// MARK: - PeliknSplashView
// Native animated launch screen overlay shown on top of WKWebView.
// Exactly mirrors the /icon-preview web animation: halo bloom → icon rise
// + glow burst → letter stagger → tagline → full-screen fade-out.
// Running natively in CoreAnimation means animations are GPU-compositor-driven
// and never depend on JavaScript, HTML parsing, or WKWebView render timing.
//
// Timing (matches web preview millisecond-for-millisecond):
//   0.0s  halo bloom        (0.9s, spring)
//   0.1s  icon rise         (0.5s, spring, 0.1s delay)
//   0.55s glow burst        (1.0s, ease-out, 0.55s delay)
//   0.10–0.30s letters       (0.55s each, 0.04s stagger, spring)
//   0.55s tagline           (0.55s, spring)
//   2.2s  pk-splash-done fires + fade starts (0.4s)
//   2.6s  view removed

final class PeliknSplashView: UIView {

    // ── Palette ───────────────────────────────────────────────────────────────
    private static let bgDark   = UIColor(red: 42/255,  green: 74/255,  blue: 64/255,  alpha: 1) // #2A4A40
    private static let bgLight  = UIColor(red: 45/255,  green: 79/255,  blue: 69/255,  alpha: 1) // #2D4F45
    private static let glowGreen = UIColor(red: 120/255, green: 210/255, blue: 150/255, alpha: 0.7)

    // ── Sub-layers / views ────────────────────────────────────────────────────
    private let bgGradient   = CAGradientLayer()
    private let haloGradient = CAGradientLayer()
    private let iconWrap     = UIView()
    private let glowGradient = CAGradientLayer()
    private let iconShapeLayer = CAShapeLayer()
    private let wordRow      = UIView()
    private let tagLabel     = UILabel()

    private var letterContainers: [UIView]  = []
    private var letterLabels:     [UILabel] = []
    private var didStart = false

    // ── spring timing function (.22,.9,.28,1) ─────────────────────────────────
    private let spring = CAMediaTimingFunction(controlPoints: 0.22, 0.9, 0.28, 1.0)
    private let easeOut = CAMediaTimingFunction(name: .easeOut)

    // MARK: – Init
    override init(frame: CGRect) {
        super.init(frame: frame)
        buildSubviews()
    }
    required init?(coder: NSCoder) { fatalError() }

    // MARK: – Build
    private func buildSubviews() {
        // ── Background radial gradient (120% 80% at 50% 35%) ─────────────────
        bgGradient.type       = .radial
        bgGradient.colors     = [Self.bgLight.cgColor, Self.bgDark.cgColor]
        bgGradient.startPoint = CGPoint(x: 0.5,  y: 0.35)
        bgGradient.endPoint   = CGPoint(x: 1.10, y: 0.75)
        layer.addSublayer(bgGradient)

        // ── Halo: 260pt radial white glow ─────────────────────────────────────
        let haloSize: CGFloat = 260
        haloGradient.type       = .radial
        haloGradient.colors     = [
            UIColor.white.withAlphaComponent(0.22).cgColor,
            UIColor.white.withAlphaComponent(0.06).cgColor,
            UIColor.clear.cgColor
        ]
        haloGradient.locations  = [0, 0.4, 0.7]
        haloGradient.startPoint = CGPoint(x: 0.5, y: 0.5)
        haloGradient.endPoint   = CGPoint(x: 1.0, y: 1.0)
        haloGradient.bounds     = CGRect(x: 0, y: 0, width: haloSize, height: haloSize)
        haloGradient.cornerRadius = haloSize / 2
        haloGradient.masksToBounds = true
        haloGradient.transform  = CATransform3DMakeScale(0.3, 0.3, 1)
        haloGradient.opacity    = 0
        layer.addSublayer(haloGradient)

        // ── Icon container (will be translated+scaled for icon-rise) ──────────
        iconWrap.backgroundColor = .clear
        iconWrap.alpha = 0
        addSubview(iconWrap)

        // Glow burst: 200pt green radial, behind the icon
        let glowSize: CGFloat = 200
        glowGradient.type       = .radial
        glowGradient.colors     = [
            Self.glowGreen.cgColor,
            UIColor(red: 80/255, green: 180/255, blue: 120/255, alpha: 0.2).cgColor,
            UIColor.clear.cgColor
        ]
        glowGradient.locations  = [0, 0.45, 0.7]
        glowGradient.startPoint = CGPoint(x: 0.5, y: 0.5)
        glowGradient.endPoint   = CGPoint(x: 1.0, y: 1.0)
        glowGradient.bounds     = CGRect(x: 0, y: 0, width: glowSize, height: glowSize)
        glowGradient.cornerRadius = glowSize / 2
        glowGradient.masksToBounds = true
        glowGradient.transform  = CATransform3DMakeScale(0.3, 0.3, 1)
        glowGradient.opacity    = 0
        iconWrap.layer.addSublayer(glowGradient)

        // Icon shape: two white CAShapeLayers from exact SVG path data
        iconShapeLayer.path      = makeIconPath()
        iconShapeLayer.fillColor = UIColor.white.cgColor
        iconShapeLayer.bounds    = CGRect(x: 0, y: 0, width: 120, height: 120)
        iconWrap.layer.addSublayer(iconShapeLayer)

        // ── Word row ("Pelikn") ────────────────────────────────────────────────
        wordRow.backgroundColor = .clear
        wordRow.clipsToBounds   = false
        addSubview(wordRow)

        // ── Tagline ────────────────────────────────────────────────────────────
        let kern: CGFloat = 0.28 * 11  // letterSpacing: 0.28em at 11pt
        tagLabel.attributedText = NSAttributedString(
            string: "FOOD SAFETY, SIMPLIFIED",
            attributes: [
                .font: UIFont.systemFont(ofSize: 11, weight: .medium),
                .foregroundColor: UIColor.white.withAlphaComponent(0.6),
                .kern: kern
            ]
        )
        tagLabel.textAlignment = .center
        tagLabel.alpha = 0
        addSubview(tagLabel)
    }

    // MARK: – Layout
    override func layoutSubviews() {
        super.layoutSubviews()
        let cx = bounds.midX
        let cy = bounds.midY

        bgGradient.frame = bounds

        // Halo centred on screen
        haloGradient.position = CGPoint(x: cx, y: cy)

        // Icon wrap: 120×120, positioned so centre is ~36pt above centre
        let iconSize: CGFloat = 120
        let iconCY = cy - 36
        iconWrap.frame = CGRect(x: cx - iconSize/2, y: iconCY - iconSize/2,
                                width: iconSize, height: iconSize)
        glowGradient.position  = CGPoint(x: iconSize/2, y: iconSize/2)
        iconShapeLayer.position = CGPoint(x: iconSize/2, y: iconSize/2)

        // Word row: measure total width of "Pelikn" at 48pt bold, −0.01em kern
        buildLettersIfNeeded()
        let wordHeight: CGFloat = 58
        let wordY = iconCY + iconSize/2 + 16
        wordRow.frame = CGRect(x: cx - wordRowWidth()/2, y: wordY,
                               width: wordRowWidth(), height: wordHeight)

        // Tagline below word row
        tagLabel.sizeToFit()
        tagLabel.center = CGPoint(x: cx,
                                  y: wordY + wordHeight + 16 + tagLabel.bounds.height / 2)
    }

    // MARK: – Letters
    private func buildLettersIfNeeded() {
        guard letterContainers.isEmpty else { return }
        let letters: [String] = ["P","e","l","i","k","n"]
        let font = UIFont.systemFont(ofSize: 48, weight: .bold)
        let height: CGFloat = 58
        var xOffset: CGFloat = 0

        for ch in letters {
            let attrs: [NSAttributedString.Key: Any] = [.font: font, .kern: -0.48]
            let w = (ch as NSString).size(withAttributes: attrs).width

            let container = UIView(frame: CGRect(x: xOffset, y: 0, width: w, height: height))
            container.clipsToBounds   = true
            container.backgroundColor = .clear

            let lbl = UILabel(frame: CGRect(x: 0, y: 0, width: w, height: height))
            lbl.text          = ch
            lbl.font          = font
            lbl.textColor     = .white
            lbl.textAlignment = .center
            container.addSubview(lbl)
            wordRow.addSubview(container)

            letterContainers.append(container)
            letterLabels.append(lbl)
            xOffset += w
        }
    }

    private func wordRowWidth() -> CGFloat {
        guard !letterContainers.isEmpty else { return 0 }
        return letterContainers.reduce(0) { $0 + $1.bounds.width }
    }

    // MARK: – Start
    func startAnimation() {
        guard !didStart else { return }
        didStart = true

        layoutIfNeeded()
        let now = CACurrentMediaTime()

        // ── 1. Halo bloom — 0s, 0.9s ─────────────────────────────────────────
        animateLayer(
            haloGradient,
            keyPath:    nil,
            animations: [
                opacity(from: 0, to: 1),
                scaleXY(from: 0.3, to: 1.0)
            ],
            duration:  0.9,
            beginTime: now,
            timing:    spring,
            fillBoth:  true
        )
        haloGradient.opacity   = 1
        haloGradient.transform = CATransform3DIdentity

        // ── 2. Icon rise — 0.1s delay, 0.5s ──────────────────────────────────
        let iconOpacity = basicAnim(keyPath: "opacity",   from: 0, to: 1)
        let iconTransY  = basicAnim(keyPath: "transform.translation.y", from: 20, to: 0)
        let iconScale   = basicAnim(keyPath: "transform.scale", from: 0.9, to: 1.0)

        let iconGroup = group([iconOpacity, iconTransY, iconScale],
                              duration: 0.5, beginTime: now + 0.1, timing: spring)
        iconWrap.layer.add(iconGroup, forKey: "iconRise")
        iconWrap.alpha = 1

        // ── 3. Glow burst — 0.55s delay, 1.0s ────────────────────────────────
        let glowOpacity = CAKeyframeAnimation(keyPath: "opacity")
        glowOpacity.values   = [0, 1, 0]
        glowOpacity.keyTimes = [0, 0.3, 1]

        let glowScale = CAKeyframeAnimation(keyPath: "transform")
        glowScale.values = [
            CATransform3DMakeScale(0.3, 0.3, 1),
            CATransform3DMakeScale(1.1, 1.1, 1),
            CATransform3DMakeScale(1.8, 1.8, 1)
        ]
        glowScale.keyTimes = [0, 0.3, 1]

        let glowGroup = group([glowOpacity, glowScale],
                              duration: 1.0, beginTime: now + 0.55, timing: easeOut)
        glowGradient.add(glowGroup, forKey: "glowBurst")

        // ── 4. Letter stagger — 0.10s + i×0.04s, 0.55s each ─────────────────
        for (i, lbl) in letterLabels.enumerated() {
            let delay  = 0.10 + Double(i) * 0.04
            let height = letterContainers[i].bounds.height

            let letterOpacity = CAKeyframeAnimation(keyPath: "opacity")
            letterOpacity.values   = [0, 1, 1]
            letterOpacity.keyTimes = [0, 0.45, 1]

            let letterSlide = basicAnim(keyPath: "transform.translation.y",
                                        from: height, to: 0)

            let lg = group([letterOpacity, letterSlide],
                           duration: 0.55, beginTime: now + delay, timing: spring)
            lbl.layer.add(lg, forKey: "letterRise")
        }

        // ── 5. Tagline — 0.55s delay, 0.55s ──────────────────────────────────
        let tagOpacity   = basicAnim(keyPath: "opacity", from: 0, to: 0.6)
        let tagTranslate = basicAnim(keyPath: "transform.translation.y", from: 5, to: 0)
        let tagGroup = group([tagOpacity, tagTranslate],
                             duration: 0.55, beginTime: now + 0.55, timing: spring)
        tagLabel.layer.add(tagGroup, forKey: "tagline")
        tagLabel.alpha = 0.6

        // ── 6. Signal web layer + fade out at 2.2s ────────────────────────────
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            guard let self else { return }
            self.signalWebSplashDone()
            UIView.animate(withDuration: 0.4, delay: 0, options: .curveEaseOut) {
                self.alpha = 0
            } completion: { _ in
                self.removeFromSuperview()
            }
        }
    }

    // MARK: – CoreAnimation helpers
    private func basicAnim(keyPath: String, from: Any, to: Any) -> CABasicAnimation {
        let a = CABasicAnimation(keyPath: keyPath)
        a.fromValue = from
        a.toValue   = to
        return a
    }

    private func opacity(from: Float, to: Float) -> CABasicAnimation {
        basicAnim(keyPath: "opacity", from: from, to: to)
    }

    private func scaleXY(from: CGFloat, to: CGFloat) -> CABasicAnimation {
        basicAnim(keyPath: "transform",
                  from: CATransform3DMakeScale(from, from, 1),
                  to:   CATransform3DMakeScale(to, to, 1))
    }

    private func group(_ anims: [CAAnimation], duration: CFTimeInterval,
                       beginTime: CFTimeInterval,
                       timing: CAMediaTimingFunction) -> CAAnimationGroup {
        let g = CAAnimationGroup()
        g.animations    = anims
        g.duration      = duration
        g.beginTime     = beginTime
        g.timingFunction = timing
        g.fillMode      = .both
        g.isRemovedOnCompletion = false
        return g
    }

    private func animateLayer(_ layer: CALayer, keyPath: String?,
                              animations: [CABasicAnimation],
                              duration: CFTimeInterval, beginTime: CFTimeInterval,
                              timing: CAMediaTimingFunction, fillBoth: Bool) {
        let g = group(animations, duration: duration, beginTime: beginTime, timing: timing)
        layer.add(g, forKey: keyPath)
    }

    // MARK: – Signal JavaScript
    // Fires window.dispatchEvent(new CustomEvent('pk-splash-done')) in WKWebView.
    // LandingPage listens for this to start entrance animations.
    private func signalWebSplashDone() {
        let js = """
            window.__peliknSplashDone = true;
            try {
                window.dispatchEvent(new CustomEvent('pk-splash-done'));
            } catch(_) {}
        """
        // Primary: via Capacitor bridge
        if let vc = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?
            .rootViewController as? CAPBridgeViewController,
           let wv = vc.bridge?.webView {
            wv.evaluateJavaScript(js, completionHandler: nil)
            return
        }
        // Fallback: walk view hierarchy for any WKWebView
        findWebView(in: UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }))?
            .evaluateJavaScript(js, completionHandler: nil)
    }

    private func findWebView(in view: UIView?) -> WKWebView? {
        guard let view else { return nil }
        if let wv = view as? WKWebView { return wv }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }

    // MARK: – Icon SVG paths
    // Exact path data from viewBox="0 0 218.749 224.045", scaled uniformly
    // to fit 120×120pt (scale = 120/224.045 ≈ 0.5356).
    private func makeIconPath() -> CGPath {
        let s: CGFloat = 120.0 / 224.045  // uniform scale preserving aspect ratio
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x*s, y: y*s) }

        let path = UIBezierPath()

        // ── Path 1: cup / bowl shape ──────────────────────────────────────────
        path.move(to: pt(111.581, 104.182))
        path.addCurve(to: pt(65.6202, 105.829),
                      controlPoint1: pt(96.2532, 104.543), controlPoint2: pt(80.9327, 105.088))
        path.addCurve(to: pt(41.575, 105.113),
                      controlPoint1: pt(60.5271, 106.056), controlPoint2: pt(45.127, 107.88))
        path.addCurve(to: pt(41.3785, 101.335),
                      controlPoint1: pt(40.7355, 102.743), controlPoint2: pt(40.8666, 103.955))
        path.addCurve(to: pt(50.4259, 98.659),
                      controlPoint1: pt(43.6299, 98.8182), controlPoint2: pt(47.2266, 98.3284))
        path.addCurve(to: pt(139.38, 94.6178),
                      controlPoint1: pt(63.5708, 100.006), controlPoint2: pt(131.793, 91.8746))
        path.addCurve(to: pt(129.368, 111.762),
                      controlPoint1: pt(143.225, 99.2529), controlPoint2: pt(133.006, 106.588))
        path.addCurve(to: pt(77.5307, 168.731),
                      controlPoint1: pt(114.802, 132.477), controlPoint2: pt(110.197, 170.39))
        path.addCurve(to: pt(46.7483, 115.308),
                      controlPoint1: pt(49.3708, 165.694), controlPoint2: pt(45.8813, 136.75))
        path.addCurve(to: pt(117.612, 105.315),
                      controlPoint1: pt(70.6601, 112.405), controlPoint2: pt(93.878, 108.474))
        path.addCurve(to: pt(111.581, 104.182),
                      controlPoint1: pt(116.161, 104.28),  controlPoint2: pt(113.504, 104.335))
        path.close()

        // ── Path 2: hook / tail shape ─────────────────────────────────────────
        path.move(to: pt(148.644, 51.1993))
        path.addCurve(to: pt(164.264, 109.344),
                      controlPoint1: pt(183.239, 49.7481), controlPoint2: pt(187.978, 90.0071))
        path.addCurve(to: pt(163.008, 168.658),
                      controlPoint1: pt(142.392, 127.174), controlPoint2: pt(130.764, 152.291))
        path.addLine(to: pt(160.027, 168.645))
        path.addCurve(to: pt(134.31, 138.44),
                      controlPoint1: pt(139.961, 168.474), controlPoint2: pt(133.495, 157.422))
        path.addCurve(to: pt(164.662, 95.8485),
                      controlPoint1: pt(137.83, 118.498),  controlPoint2: pt(152.458, 110.25))
        path.addCurve(to: pt(146.305, 60.1389),
                      controlPoint1: pt(177.496, 80.4735), controlPoint2: pt(167.956, 55.9997))
        path.addCurve(to: pt(123.111, 82.935),
                      controlPoint1: pt(135.522, 62.1963), controlPoint2: pt(128.977, 74.4423))
        path.addCurve(to: pt(112.322, 83.3085),
                      controlPoint1: pt(119.461, 82.935),  controlPoint2: pt(115.959, 83.1248))
        path.addCurve(to: pt(148.644, 51.1993),
                      controlPoint1: pt(122.658, 68.6928), controlPoint2: pt(129.24, 54.0955))
        path.close()

        return path.cgPath
    }
}
