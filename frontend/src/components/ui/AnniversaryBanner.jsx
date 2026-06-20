/**
 * AnniversaryBanner Component
 * Displays the University of Gondar anniversary banner in a compact, elegant container
 * - Fully visible image without cropping (object-fit: contain)
 * - Max height of 300px for compact display
 * - Dark blue background to match enterprise aesthetic
 * - Professional styling with border-radius and soft shadow
 * - Fully responsive across mobile and desktop
 */

export default function AnniversaryBanner() {
  return (
    <div className="w-full flex justify-center py-6 px-4">
      <div
        className="
          bg-blue-950 
          rounded-[20px] 
          shadow-lg shadow-blue-900/20
          overflow-hidden
          max-w-full
          sm:max-w-2xl
        "
        style={{
          aspectRatio: '16 / 9',
          maxHeight: '300px',
        }}
      >
        <img
          src="/images/uog-anniversary-banner.jpg"
          alt="University of Gondar Anniversary Banner"
          className="
            w-full 
            h-full 
            object-contain
            bg-blue-950
          "
        />
      </div>
    </div>
  );
}
