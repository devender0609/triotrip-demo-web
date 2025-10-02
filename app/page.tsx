/* ...top of file unchanged... */

          <div>
            <label>Origin</label>
            <AirportField
              id="origin"
              label=""
              code={originCode}
              initialDisplay={originDisplay}
              onTextChange={(t) => setOriginDisplay(t)}
              onChangeCode={(code: string, display: string) => {
                setOriginCode(code);
                setOriginDisplay(display);
              }}
            />
          </div>

          <div className="swapcell" aria-hidden>
            <button
              type="button"
              className="swap"
              title="Swap origin & destination"
              onClick={swapOriginDest}
            >
              ⇄
            </button>
          </div>

          <div>
            <label>Destination</label>
            <AirportField
              id="destination"
              label=""
              code={destCode}
              initialDisplay={destDisplay}
              onTextChange={(t) => setDestDisplay(t)}
              onChangeCode={(code: string, display: string) => {
                setDestCode(code);
                setDestDisplay(display);
              }}
            />
          </div>

/* ...rest unchanged... */

<style jsx>{`
/* ...existing styles above ... */

/* Make ALL inputs visually consistent; AirportField is borderless by design */
input[type="date"], input[type="number"], input[type="text"], select {
  height: 42px; padding: 0 10px; border: 1px solid #e2e8f0; border-radius: 10px; width: 100%; background: #fff;
}
:global(.af-input) {
  height: 42px; padding: 0 10px; border: none; border-radius: 10px; background: #fff; width: 100%;
  /* keep no lines, but align height/padding with other fields */
}

/* keep your other styles unchanged... */
`}</style>
