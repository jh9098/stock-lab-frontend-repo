import { useMemo } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";

export default function useQuillImageModules(quillRef, setMessage, toolbarOverrides) {
  return useMemo(() => {
    const handler = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        setMessage("이미지 업로드 중...");
        try {
          const storageRef = ref(storage, `content_images/${file.name}_${Date.now()}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setMessage(`업로드 진행률: ${progress.toFixed(1)}%`);
            },
            (error) => {
              console.error("이미지 업로드 실패", error);
              setMessage("이미지 업로드에 실패했습니다.");
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const editor = quillRef.current?.getEditor?.();
              if (editor) {
                const range = editor.getSelection();
                const index = range ? range.index : editor.getLength();
                editor.insertEmbed(index, "image", downloadURL);
                editor.setSelection(index + 1);
              }
              setMessage("이미지가 본문에 삽입되었습니다.");
            }
          );
        } catch (error) {
          console.error("이미지 업로드 오류", error);
          setMessage("이미지를 업로드하지 못했습니다.");
        }
      };
      input.click();
    };

    const defaultToolbar = [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image", "video"],
      ["clean"],
    ];

    const toolbar = Array.isArray(toolbarOverrides) ? toolbarOverrides : defaultToolbar;

    return {
      toolbar: {
        container: toolbar,
        handlers: {
          image: handler,
        },
      },
    };
  }, [quillRef, setMessage, toolbarOverrides]);
}
