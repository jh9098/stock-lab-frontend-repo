import { useAdminContext } from "../AdminContext";

export default function AdminDashboard() {
  const { message } = useAdminContext();

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold text-white">관리자 홈</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        상단 메뉴를 통해 블로그, 종목 분석, 상담 게시판, 포트폴리오 데이터를 관리할 수 있습니다.
        각 메뉴는 Firebase Firestore와 연동되어 있으며, 저장 후에는 즉시 서비스 화면에 반영됩니다.
      </p>
      {!message && (
        <p className="text-gray-400 text-sm">
          작업 후에는 좌측 하단의 메시지 영역에 저장 결과가 표시됩니다. 오류가 발생하면 안내 메시지를 확인한 뒤 다시 시도해주세요.
        </p>
      )}
    </section>
  );
}
